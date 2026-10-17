import { isVietcombankDeliveryRecorded } from "@modules/queues/vietcombank-delivery"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { VietcombankReceiptService } from "@modules/domain/vietcombank-inbox"
import { BankFeedReceiptService } from "@modules/domain/bank-feed-inbox"
import type { IncomingCredit } from "@modules/domain/bank-feed-inbox"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { VIETCOMBANK_DELIVERY_QUEUE } from "@modules/queues/vietcombank-delivery"
import { BANK_FEED_DELIVERY_QUEUE } from "@modules/queues/bank-feed-delivery"
import type { BankFeedDeliveryRecorded } from "@modules/queues/bank-feed-delivery"
import type { VietcombankDeliveryRecorded } from "./billing.contracts"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { EventOrigin } from "@modules/domain/inbound-events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { createHash } from "node:crypto"
import { eachInOrder } from "@modules/platform/primitives"
import { BankCreditQueue, isBankCreditPayload } from "@modules/queues/bank-credit"
import { SIMULATED_BANK, simulatedBankEventId, simulatedCreditOf } from "./bank.policy"
import { InjectBillingOptions } from "./billing.decorators"
import type { BillingOptions } from "./billing.options"
import type {
    RawBody,
    HeaderValue,
    BankFeedProvider,
    ManualCredit,
    ProvenConnection,
    SimulatedDelivery,
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
import { sepayPayloadOf } from "./sepay.policy"
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
    /** Whether the money is real. */
    readonly origin: EventOrigin
    /** A note the person added, or undefined. */
    readonly note?: string
}

@Injectable()
/**
 * Books the credits a payment connection reports. The webhook door proves each delivery before its receipt is recorded; a deferred credit
 * becomes one inbound payment event, once per workspace and provider transaction id, so a repeat is counted without a second event
 * or job. A credit on a connection with no accounting agent bound is remembered on the connection only. The event and its
 * reconcile job are written in one transaction.
 */
export class BankFeedService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectBillingOptions() private readonly options: BillingOptions,
        private readonly proof: PaymentProofService,
        private readonly inbound: InboundEventsService,
        private readonly credits: BankCreditQueue,
        private readonly members: WorkspaceMembersService,
        private readonly events: EventsService,
        private readonly vietcombankInbox: VietcombankReceiptService,
        private readonly bankFeedInbox: BankFeedReceiptService,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
    ) {}

    /**
     * An owner or manager enters money they know arrived. It goes through the same intake as every other credit (one inbound payment
     * event and its reconcile job, once per day, amount and content), is labelled simulated like every manual input, and leaves a line
     * in the evidence log. Answers whether the same evidence had already been entered.
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
                origin: "simulated",
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

    /** The simulated Vietcombank door: one credit into the one configured workspace, always stored as simulated money. */
    async acceptSimulatedCredit(delivery: SimulatedDelivery): Promise<void> {
        this.proof.verifySimulatedBank(delivery.secret)
        const workspaceId = this.options.simulatedBank.workspaceId
        if (workspaceId === undefined) throw new BillingError({ code: BillingErrorCode.FeedNotConfigured })
        const credit = simulatedCreditOf(parseJsonObject(delivery.rawBody))
        if (credit === null) throw new BillingError({ code: BillingErrorCode.WebhookInvalid })
        const deliveryId = simulatedBankEventId(credit.eventId)
        await this.entityManager.transaction(async (manager) => {
            if (!(await this.vietcombankInbox.claim(manager, deliveryId, { workspaceId, credit }))) return
            const message: VietcombankDeliveryRecorded = { deliveryId }
            await this.outbox.write(manager, VIETCOMBANK_DELIVERY_QUEUE, message, {
                dedupeKey: `${VIETCOMBANK_DELIVERY_QUEUE}:${deliveryId}`,
            })
        })
    }

    /** Rejects malformed jobs before fencing; a valid receipt effect follows its successful fence. */
    async processRecordedDeliveryJob(job: ClaimedJob, claims: JobClaims): Promise<void> {
        if (!isVietcombankDeliveryRecorded(job.payload)) return
        await claims.advance({
            jobId: job.jobId,
            expectedFencingToken: job.fencingToken,
            step: "vietcombank-delivery",
        })
        await this.processRecordedDelivery(job.payload)
    }

    /** Books a committed simulated-bank receipt once, atomically with its completion. */
    processRecordedDelivery(message: VietcombankDeliveryRecorded): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const pending = await this.vietcombankInbox.lock(manager, message.deliveryId)
            if (pending === undefined) return
            const { workspaceId, credit } = pending.payload
            await this.book(manager, {
                workspaceId,
                amount: credit.amount,
                content: credit.content,
                sender: credit.sender,
                eventId: simulatedBankEventId(credit.eventId),
                bankName: SIMULATED_BANK.name,
                origin: "simulated",
            })
            await this.vietcombankInbox.complete(manager, pending.id)
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
        await this.proof.proveSepayFeed({ authorization, connectionId: connection, rawBody })
    }

    /** Records one verified incoming SePay feed transaction for deferred booking. */
    acceptSepayFeedDelivery(rawBody: RawBody, connection: string): Promise<void> {
        const payload = sepayPayloadOf(parseJsonObject(rawBody))
        const amount = payload.transferAmount
        if (payload.transferType !== "in" || amount === undefined || amount <= 0) return Promise.resolve()
        return this.recordFeedDelivery("sepay-feed", `${connection}:sepay:${payload.id}`, connection, [
            {
                amount,
                content: (payload.content ?? payload.description ?? payload.code ?? "").trim(),
                eventId: `sepay:${payload.id}`,
                fallbackBankName: payload.gateway ?? "SePay",
            },
        ])
    }

    /** Resolves one committed provider receipt and books all its credits before marking it complete. */
    processRecordedFeedDelivery(message: BankFeedDeliveryRecorded): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const pending = await this.bankFeedInbox.lock(manager, message.provider, message.deliveryId)
            if (pending === undefined) return
            const [owner] = await manager.query<Array<FeedConnectionRow>>(SELECT_FEED_CONNECTION, [
                pending.payload.connection,
            ])
            if (owner !== undefined) {
                await eachInOrder(pending.payload.credits, (credit) =>
                    this.feedInTransaction(
                        manager,
                        { connectionId: pending.payload.connection, workspaceId: owner.workspace_id },
                        credit,
                    ),
                )
            }
            await this.bankFeedInbox.complete(manager, pending.id)
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
     * The effect of one reconcile-bank-credit job: until an accounting agent matches the credit to a payment record, the credit is
     * held for the owner's check, never completed by itself. Any other payload changes nothing.
     */
    async holdForOwnerCheck(payload: object): Promise<void> {
        if (isBankCreditPayload(payload)) await this.inbound.holdForOwnerCheck(payload.inboundEventId)
    }

    /**
     * What every payment connection does with an authenticated credit: remember that the connection works (this is what the wizard
     * waits for, even before an agent is bound), then book the credit when an accounting agent is bound to it. A credit on a test
     * connection is stored as simulated so accounting never treats it as real money.
     */
    private async feedInTransaction(
        tx: EntityManager,
        connection: ProvenConnection,
        credit: IncomingCredit,
    ): Promise<void> {
        const at = this.clock.now()
        const [state] = await tx.query<Array<ConnectionStateRow>>(SELECT_CONNECTION_STATE, [connection.connectionId])
        await tx.query(MARK_CONNECTION_FED, [
            connection.connectionId,
            at,
            JSON.stringify({ amount: Math.round(credit.amount), content: credit.content, at: at.toISOString() }),
        ])
        const [agent] = await tx.query<Array<AgentIdRow>>(SELECT_BOUND_ACCOUNTING_AGENT, [connection.connectionId])
        if (agent === undefined) return
        await this.book(tx, {
            workspaceId: connection.workspaceId,
            amount: credit.amount,
            content: credit.content,
            sender: null,
            eventId: credit.eventId,
            bankName: state?.name ?? credit.fallbackBankName,
            origin: state?.environment === "test" ? "simulated" : "live",
        })
    }

    /** Records the credit and queues its reconcile job; answers whether the same credit had already been recorded. */
    private async book(tx: EntityManager, booking: Booking): Promise<boolean> {
        const amountVnd = Math.round(booking.amount)
        const recorded = await this.inbound.recordBankPayment({
            manager: tx,
            workspaceId: booking.workspaceId,
            origin: booking.origin,
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
