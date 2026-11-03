import { BankFeedReceiptService } from "@modules/domain/bank-feed-inbox"
import type { FeedReceiptPayload, IncomingCredit } from "@modules/domain/bank-feed-inbox"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { BANK_FEED_DELIVERY_QUEUE } from "@modules/queues/bank-feed-delivery"
import type { BankFeedDeliveryRecorded } from "@modules/queues/bank-feed-delivery"
import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { FeedWebhookRegistry } from "@modules/domain/provider-registry"
import type { FeedWebhookPort } from "@modules/domain/provider-registry"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { TransactionsService } from "@modules/domain/transactions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { createHash } from "node:crypto"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentTagService } from "@modules/domain/agent-work"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { BankCreditBookedEvent } from "@modules/events/api"
import type {
    RawBody,
    HeaderValue,
    BankFeedProvider,
    FeedCreditAnswer,
    ManualCredit,
    ProvenConnection,
} from "./billing.contracts"
import { cassoCredits, isCassoError } from "./casso.policy"
import { InjectBankFeedFlow } from "./billing.decorators"
import type { BankFeedFlow } from "./billing.decorators"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"
import { payosBodyOf, readPayosDelivery } from "./payos.policy"
import { parseJsonObject } from "./webhook-body.policy"
import { ConnectionBindingsReadService } from "@modules/domain/connections"

/** The locale of the lines billing writes into the shared records: the workspace owners read them in Vietnamese. */
const RECORD_LOCALE = "vi"

/** What a tag of the bound agent says started it: the bank feed. */
const BANK_FEED_TAG_SOURCE = "bank_feed"

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
 * or event. A credit on a connection with no accounting agent bound, or on a connection in the provider's test environment, is
 * remembered on the connection only and never reaches a business table. The inbound event and its `bank_credit_booked` fact are written in one
 * transaction.
 */
export class BankFeedService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly proof: PaymentProofService,
        private readonly inbound: InboundEventsService,
        @InjectEventBus() private readonly bus: EventBus,
        private readonly members: WorkspaceMembersService,
        private readonly events: EventsService,
        private readonly transactions: TransactionsService,
        private readonly bankFeedInbox: BankFeedReceiptService,
        private readonly webhooks: FeedWebhookRegistry,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly bindings: AgentBindingsService,
        private readonly connections: ConnectionBindingsReadService,
        private readonly tags: AgentTagService,
        @Optional() @InjectBankFeedFlow() private readonly flow: BankFeedFlow | null = null,
    ) {}

    /**
     * An owner or manager enters money they know arrived: real money, booked as live through the same intake as every other credit
     * (one inbound payment event and its `bank_credit_booked` fact, once per day, amount and content). Its source is `manual` (the `manual:`
     * event id and the manual bank name) and the member who entered it is the actor of its evidence line. Answers whether the
     * same evidence had already been entered.
     */
    async acceptManualCredit(userId: string, workspaceId: string, credit: ManualCredit): Promise<boolean> {
        const member = await this.members.require(userId, workspaceId, MANAGERS)
        const amount = Math.round(credit.amount)
        return this.entityManager.transaction(async (tx) => {
            const booked = await this.book(tx, {
                workspaceId,
                amount,
                content: credit.content,
                note: credit.note,
                sender: credit.payer === undefined || credit.payer === "" ? null : credit.payer,
                eventId: `manual:${credit.date}:${amount}:${credit.content}`,
                bankName: this.catalog.get("billing.manualBank", {}, RECORD_LOCALE),
            })
            const duplicate = booked === null
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

    /**
     * Proves the workspace feed credential of a provider before its HTTP door admits the raw delivery to receipt intake. A refused key
     * is remembered by the provider for the connection page; any other failure is not the sender's doing.
     */
    async verifyFeedDelivery(
        authorization: HeaderValue,
        connection: string,
        rawBody: RawBody,
        provider: string,
    ): Promise<void> {
        try {
            await this.proof.proveFeed(provider, { authorization, connectionId: connection, rawBody })
        } catch (error) {
            if (error instanceof BillingError && error.code === BillingErrorCode.WebhookUnauthorized) {
                await this.webhooks.of(provider)?.traceRefusal(connection)
            }
            throw error
        }
    }

    /**
     * Records one verified feed transaction of a provider for deferred booking: money in as a credit, money out as a debit; anything its
     * provider reads as no money move (a test ping, a zero amount) is acknowledged without a receipt, and a delivery it cannot read is invalid.
     */
    acceptFeedDelivery(rawBody: RawBody, connection: string, provider: string): Promise<void> {
        const port = this.webhooks.of(provider)
        if (port === undefined) return Promise.reject(new BillingError({ code: BillingErrorCode.WebhookInvalid }))
        return port.traceIntake(connection, rawBody, () => this.bookFeedDelivery(port, rawBody, connection))
    }

    private async bookFeedDelivery(port: FeedWebhookPort, rawBody: RawBody, connection: string): Promise<void> {
        const reading = port.read(parseJsonObject(rawBody))
        if (reading.kind === "invalid") throw new BillingError({ code: BillingErrorCode.WebhookInvalid })
        if (reading.kind === "ignored") return
        await this.recordFeedDelivery(port.inboxProvider, `${connection}:${reading.credit.eventId}`, connection, [
            reading.credit,
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
            const workspaceId = await this.connections.workspaceOf(pending.payload.connection, manager)
            const answers: Array<FeedCreditAnswer> = []
            if (workspaceId !== null) {
                const connection = { connectionId: pending.payload.connection, workspaceId }
                await eachInOrder(pending.payload.credits, async (credit) => {
                    answers.push(await this.feedInTransaction(manager, connection, credit))
                })
            }
            await this.bankFeedInbox.complete(manager, pending.id)
            return answers
        })
    }

    /**
     * Records one transaction a reconcile run read back from its provider, through the receipt path a webhook delivery takes, under the
     * delivery key the webhook uses: a transaction the webhook already delivered is not recorded again. Answers true when this call
     * recorded it, that is when the webhook never did.
     */
    acceptPolledCredit(
        connection: string,
        provider: BankFeedProvider,
        deliveryId: string,
        credit: IncomingCredit,
    ): Promise<boolean> {
        return this.claimFeedDelivery(provider, deliveryId, { connection, credits: [credit], source: "poll" })
    }

    private async recordFeedDelivery(
        provider: BankFeedProvider,
        deliveryId: string,
        connection: string,
        credits: ReadonlyArray<IncomingCredit>,
    ): Promise<void> {
        await this.claimFeedDelivery(provider, deliveryId, { connection, credits })
    }

    /** Claims the receipt once and hands it to the deferred booking job in the same transaction; answers false for a repeat or an empty delivery. */
    private claimFeedDelivery(
        provider: BankFeedProvider,
        deliveryId: string,
        payload: FeedReceiptPayload,
    ): Promise<boolean> {
        if (payload.credits.length === 0) return Promise.resolve(false)
        return this.entityManager.transaction(async (manager) => {
            if (!(await this.bankFeedInbox.claim(manager, provider, deliveryId, payload))) return false
            const message: BankFeedDeliveryRecorded = { provider, deliveryId }
            await this.outbox.write(manager, BANK_FEED_DELIVERY_QUEUE, message, {
                dedupeKey: `${BANK_FEED_DELIVERY_QUEUE}:${provider}:${deliveryId}`,
            })
            return true
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
        const state = await this.connections.stateOf(connection.connectionId, tx)
        await callDbFunction(tx, "public.connection_mark_fed", [
            connection.connectionId,
            at,
            JSON.stringify({ amount: Math.round(credit.amount), content: credit.content, at: at.toISOString() }),
        ])
        if (state?.environment === "test") return { status: "refused", code: "test_environment" }
        const [agent] = await this.bindings.agentsFor(connection.connectionId, "bank_feed", { modules: ["accounting"] })
        if (agent === undefined) return { status: "unbound" }
        if (credit.direction === "debit") return this.debit(tx, connection, credit)
        const flowOwns = await this.flowOwns(connection.workspaceId, agent.id)
        const booking = {
            workspaceId: connection.workspaceId,
            amount: credit.amount,
            content: credit.content,
            sender: null,
            eventId: credit.eventId,
            bankName: state?.name ?? credit.fallbackBankName,
        }
        const booked = await this.book(tx, booking, !flowOwns)
        if (booked === null) return { status: "duplicate" }
        if (flowOwns) await this.tagFlow(tx, connection, agent.id, credit, booked)
        return { status: "booked" }
    }

    /** Whether the bound agent's live version has a flow: then the flow alone owns the credit, and the booking path holds nothing. */
    private async flowOwns(workspaceId: string, agentId: string): Promise<boolean> {
        return this.flow !== null && (await this.flow.hasLiveFlow(workspaceId, agentId))
    }

    /**
     * A new credit of an agent whose live version has a flow reaches that agent: the transaction is recorded and the agent is tagged with
     * it, once per transaction (the wake is keyed by the connection and the provider transaction id). Exactly one path takes a credit:
     * the flow's, or with no flow the booking path alone, as before.
     */
    private async tagFlow(
        tx: EntityManager,
        connection: ProvenConnection,
        agentId: string,
        credit: IncomingCredit,
        inboundEventId: string,
    ): Promise<void> {
        const amountVnd = Math.round(credit.amount)
        const transaction = await this.transactions.open(
            {
                workspaceId: connection.workspaceId,
                inboundEventId,
                amountVnd,
                reference: credit.content === "" ? null : credit.content,
                payer: null,
            },
            tx,
        )
        await this.tags.tagAgent(
            {
                source: BANK_FEED_TAG_SOURCE,
                workspaceId: connection.workspaceId,
                toAgentId: agentId,
                text: this.catalog.get(
                    "billing.bankFeedTag",
                    { amount: amountVnd, content: credit.content },
                    RECORD_LOCALE,
                ),
                subject: `bank-transaction:${transaction.id}`,
                eventKey: `bank-feed:${connection.connectionId}:${credit.eventId}`,
            },
            tx,
        )
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

    /** Records the credit and publishes `bank_credit_booked` in the same transaction; answers the id of the inbound event, or null when the same credit had already been recorded. */
    private async book(tx: EntityManager, booking: Booking, announce = true): Promise<string | null> {
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
        if (recorded.duplicate) return null
        if (!announce) return recorded.inboundEventId
        await this.bus.publish(
            BankCreditBookedEvent.create({
                workspaceId: booking.workspaceId,
                inboundEventId: recorded.inboundEventId,
                amountVnd,
            }),
            tx,
            `bank_credit_booked:${recorded.inboundEventId}`,
        )
        return recorded.inboundEventId
    }
}
