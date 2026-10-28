import { BankFeedReceiptService } from "@modules/domain/bank-feed-inbox"
import type { IncomingCredit } from "@modules/domain/bank-feed-inbox"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { BANK_FEED_DELIVERY_QUEUE } from "@modules/queues/bank-feed-delivery"
import type { BankFeedDeliveryRecorded } from "@modules/queues/bank-feed-delivery"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { SepayConnectionService } from "@modules/domain/channel-connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { TransactionsService } from "@modules/domain/transactions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { createHash } from "node:crypto"
import { eachInOrder } from "@modules/platform/primitives"
import { BankCreditQueue } from "@modules/queues/bank-credit"
import type {
    RawBody,
    HeaderValue,
    BankFeedProvider,
    FeedCreditAnswer,
    ManualCredit,
    ProvenConnection,
} from "./billing.contracts"
import { cassoCredits, isCassoError } from "./casso.policy"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"
import { payosBodyOf, readPayosDelivery } from "./payos.policy"
import type { AgentIdRow, ConnectionStateRow, FeedConnectionRow } from "./persistence/bank-feed.rows"
import {
    MARK_CONNECTION_FED,
    SELECT_FEED_CONNECTION,
    SELECT_BOUND_ACCOUNTING_AGENT,
    SELECT_CONNECTION_STATE,
} from "./persistence/bank-feed.sql"
import { isSepayPing, sepayPayloadOf } from "./sepay.policy"
import { parseJsonObject } from "./webhook-body.policy"

/** The locale of the lines billing writes into the shared records: the workspace owners read them in Vietnamese. */
const RECORD_LOCALE = "vi"

/** Who may enter money by hand. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** One credit about to be recorded as an inbound payment event. */
interface Booking {
    /** The workspace the credit belongs to. */
    readonly workspaceId: string
    /** The credited amount in VND. */
    readonly amount: number
    /** The transfer content. */
    readonly content: string
    /** The payer name, or null. */
    readonly sender: string | null
    /** The provider-prefixed transaction id: the idempotency key. */
    readonly eventId: string
    /** The bank or gateway name shown on the event. */
    readonly bankName: string
    /** A note the person added, or undefined. */
    readonly note?: string | undefined
}

@Injectable()
/**
 * Books the credits a payment connection reports. The webhook door proves each delivery before its receipt is recorded; a deferred credit
 * becomes one inbound payment event, once per workspace and provider transaction id, so a repeat is counted without a second event
 * or job. A credit on a connection with no accounting agent bound, or on a connection in the provider's test environment, is
 * remembered on the connection only and never reaches a business table. The event and its reconcile job are written in one
 * transaction.
 */
export class BankFeedService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly proof: PaymentProofService,
        private readonly inbound: InboundEventsService,
        private readonly credits: BankCreditQueue,
        private readonly members: WorkspaceMembersService,
        private readonly events: EventsService,
        private readonly transactions: TransactionsService,
        private readonly bankFeedInbox: BankFeedReceiptService,
        private readonly sepayPage: SepayConnectionService,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
    ) {}

    /**
     * An owner or manager enters money they know arrived: real money, booked as live through the same intake as every other credit
     * (one inbound payment event and its reconcile job, once per day, amount and content). Its source is `manual` (the `manual:`
     * event id and the manual bank name) and the member who entered it is the actor of its evidence line. Answers whether the
     * same evidence had already been entered.
     */
    async acceptManualCredit(userId: string, workspaceId: string, credit: ManualCredit): Promise<boolean> {
        const member = await this.members.require(userId, workspaceId, MANAGERS)
        const amount = Math.round(credit.amount)
        return this.entityManager.transaction(async (tx) => {
            const duplicate = await this.book(tx, {
                workspaceId,
                amount,
                content: credit.content,
                note: credit.note,
                sender: credit.payer === undefined || credit.payer === "" ? null : credit.payer,
                eventId: `manual:${credit.date}:${amount}:${credit.content}`,
                bankName: this.catalog.get("billing.manualBank", {}, RECORD_LOCALE),
            })
            if (!duplicate) {
                await this.events.record(
                    {
                        workspaceId,
                        kind: "accounting.manual_evidence",
                        actor: member.displayName,
                        summary: this.catalog.get(
                            "billing.manualEvidenceLog",
                            { amount, date: credit.date },
                            RECORD_LOCALE,
                        ),
                        evidence: [credit.content, credit.note ?? ""].filter((part) => part !== "").join(" - "),
                    },
                    tx,
                )
            }
            return duplicate
        })
    }

    /** Records Casso's verified raw delivery for processing after the receipt commits. */
    acceptCassoDelivery(rawBody: RawBody, connection: string): Promise<void> {
        const raw = rawBody ?? Buffer.alloc(0)
        const body = parseJsonObject(raw)
        const credits = isCassoError(body)
            ? []
            : cassoCredits(body).map((credit) => ({
                  amount: credit.amount,
                  content: credit.content,
                  eventId: credit.eventId,
                  fallbackBankName: credit.bankName,
              }))
        const deliveryId = `${connection}:${createHash("sha256").update(raw).digest("hex")}`
        return this.recordFeedDelivery("casso", deliveryId, connection, credits)
    }

    /** Records a verified paid payOS delivery; confirmation pings and unpaid deliveries remain acknowledgements only. */
    acceptPayosDelivery(rawBody: RawBody, connection: string): Promise<void> {
        const reading = readPayosDelivery(payosBodyOf(parseJsonObject(rawBody)))
        if (reading.kind === "ignored") return Promise.resolve()
        return this.recordFeedDelivery("payos", `${connection}:${reading.eventId}`, connection, [
            {
                amount: reading.amount,
                content: reading.content,
                eventId: reading.eventId,
                fallbackBankName: "payOS",
            },
        ])
    }

    /** Proves the workspace feed credential before its HTTP door admits the raw delivery to receipt intake. */
    async verifySepayFeedDelivery(authorization: HeaderValue, connection: string, rawBody: RawBody): Promise<void> {
        try {
            await this.proof.proveSepayFeed({ authorization, connectionId: connection, rawBody })
        } catch (error) {
            // A refused key is remembered for the connection page; any other failure is not the sender's doing.
            if (error instanceof BillingError && error.code === BillingErrorCode.WebhookUnauthorized) {
                await this.sepayPage.traceRefusal(connection)
            }
            throw error
        }
    }

    /**
     * Records one verified SePay feed transaction for deferred booking: money in (`in`) as a credit, money out (`out`) as a
     * debit; any other transfer, or an amount that is not above 0, is acknowledged without a receipt.
     */
    acceptSepayFeedDelivery(rawBody: RawBody, connection: string): Promise<void> {
        return this.sepayPage.traceIntake(connection, rawBody, () => this.bookSepayFeedDelivery(rawBody, connection))
    }

    private bookSepayFeedDelivery(rawBody: RawBody, connection: string): Promise<void> {
        const body = parseJsonObject(rawBody)
        if (isSepayPing(body)) return Promise.resolve()
        const payload = sepayPayloadOf(body)
        const amount = payload.transferAmount
        const moves = payload.transferType === "in" || payload.transferType === "out"
        if (!moves || amount === undefined || amount <= 0) return Promise.resolve()
        return this.recordFeedDelivery("sepay-feed", `${connection}:sepay:${payload.id}`, connection, [
            {
                amount,
                content: (payload.content ?? payload.description ?? payload.code ?? "").trim(),
                eventId: `sepay:${payload.id}`,
                fallbackBankName: payload.gateway ?? "SePay",
                ...(payload.transferType === "out" ? { direction: "debit" as const } : {}),
            },
        ])
    }

    /**
     * Resolves one committed provider receipt and answers each of its credits before marking the receipt complete: booked, a repeat,
     * held on the connection because no accounting agent is bound, or refused because the connection runs in the provider's test
     * environment. An absent or completed receipt, or one whose connection is gone, answers no credit.
     */
    processRecordedFeedDelivery(message: BankFeedDeliveryRecorded): Promise<ReadonlyArray<FeedCreditAnswer>> {
        return this.entityManager.transaction(async (manager) => {
            const pending = await this.bankFeedInbox.lock(manager, message.provider, message.deliveryId)
            if (pending === undefined) return []
            const [owner] = await manager.query<Array<FeedConnectionRow>>(SELECT_FEED_CONNECTION, [
                pending.payload.connection,
            ])
            const answers: Array<FeedCreditAnswer> = []
            if (owner !== undefined) {
                const connection = { connectionId: pending.payload.connection, workspaceId: owner.workspace_id }
                await eachInOrder(pending.payload.credits, async (credit) => {
                    answers.push(await this.feedInTransaction(manager, connection, credit))
                })
            }
            await this.bankFeedInbox.complete(manager, pending.id)
            return answers
        })
    }

    private recordFeedDelivery(
        provider: BankFeedProvider,
        deliveryId: string,
        connection: string,
        credits: ReadonlyArray<IncomingCredit>,
    ): Promise<void> {
        if (credits.length === 0) return Promise.resolve()
        return this.entityManager.transaction(async (manager) => {
            if (!(await this.bankFeedInbox.claim(manager, provider, deliveryId, { connection, credits }))) return
            const message: BankFeedDeliveryRecorded = { provider, deliveryId }
            await this.outbox.write(manager, BANK_FEED_DELIVERY_QUEUE, message, {
                dedupeKey: `${BANK_FEED_DELIVERY_QUEUE}:${provider}:${deliveryId}`,
            })
        })
    }

    /**
     * What every payment connection does with an authenticated credit: remember that the connection works (this is what the wizard
     * waits for, even before an agent is bound), then book the credit when an accounting agent is bound to it. A connection in the
     * provider's test environment is refused with `test_environment` before any business record: its money is not real.
     */
    private async feedInTransaction(
        tx: EntityManager,
        connection: ProvenConnection,
        credit: IncomingCredit,
    ): Promise<FeedCreditAnswer> {
        const at = this.clock.now()
        const [state] = await tx.query<Array<ConnectionStateRow>>(SELECT_CONNECTION_STATE, [connection.connectionId])
        await tx.query(MARK_CONNECTION_FED, [
            connection.connectionId,
            at,
            JSON.stringify({ amount: Math.round(credit.amount), content: credit.content, at: at.toISOString() }),
        ])
        if (state?.environment === "test") return { status: "refused", code: "test_environment" }
        const [agent] = await tx.query<Array<AgentIdRow>>(SELECT_BOUND_ACCOUNTING_AGENT, [connection.connectionId])
        if (agent === undefined) return { status: "unbound" }
        if (credit.direction === "debit") return this.debit(tx, connection, credit)
        const duplicate = await this.book(tx, {
            workspaceId: connection.workspaceId,
            amount: credit.amount,
            content: credit.content,
            sender: null,
            eventId: credit.eventId,
            bankName: state?.name ?? credit.fallbackBankName,
        })
        return { status: duplicate ? "duplicate" : "booked" }
    }

    /**
     * Records money that left the account as a debit transaction: never an inbound payment event and never a reconcile job, so a
     * supplier payment is not matched against the workspace's invoices. The receipt claim already made it once per delivery.
     */
    private async debit(
        tx: EntityManager,
        connection: ProvenConnection,
        credit: IncomingCredit,
    ): Promise<FeedCreditAnswer> {
        await this.transactions.open(
            {
                workspaceId: connection.workspaceId,
                inboundEventId: null,
                amountVnd: Math.round(credit.amount),
                reference: credit.content === "" ? null : credit.content,
                payer: null,
                direction: "debit",
            },
            tx,
        )
        return { status: "debited" }
    }

    /** Records the credit and queues its reconcile job; answers whether the same credit had already been recorded. */
    private async book(tx: EntityManager, booking: Booking): Promise<boolean> {
        const amountVnd = Math.round(booking.amount)
        const recorded = await this.inbound.recordBankPayment({
            manager: tx,
            workspaceId: booking.workspaceId,
            sender: booking.sender,
            body: this.catalog.get(
                "billing.bankEventBody",
                {
                    bank: booking.bankName,
                    content: [booking.content || "\u2014", booking.note ?? ""]
                        .filter((part) => part !== "")
                        .join(" - "),
                },
                RECORD_LOCALE,
            ),
            amountVnd,
            externalRef: booking.content || null,
            providerRef: booking.eventId,
        })
        if (recorded.duplicate) return true
        await this.credits.enqueueBankCredit(
            { workspaceId: booking.workspaceId, inboundEventId: recorded.inboundEventId, amountVnd },
            tx,
        )
        return false
    }
}
