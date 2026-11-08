import { BankFeedReceiptService, type IncomingCredit } from "@modules/domain/bank-feed-inbox"
import type { BankFeedDeliveryRecorded } from "@modules/queues/bank-feed-delivery"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectEventBus, type EventBus } from "@modules/platform/event-bus"
import { BankCreditBookedEvent } from "@modules/events/api"
import type { FeedCreditAnswer, ManualCredit, ProvenConnection } from "./billing.contracts"
import { BankFeedFlowService } from "./bank-feed-flow.service"
import { ConnectionBindingsReadService } from "@modules/domain/connections"

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
 * or event. A credit on a connection with no accounting agent bound, or on a connection in the provider's test environment, is
 * remembered on the connection only and never reaches a business table. The inbound event and its `bank_credit_booked` fact are written in one
 * transaction.
 */
export class BankFeedService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly inbound: InboundEventsService,
        @InjectEventBus() private readonly bus: EventBus,
        private readonly members: WorkspaceMembersService,
        private readonly events: EventsService,
        private readonly bankFeedInbox: BankFeedReceiptService,
        private readonly bindings: AgentBindingsService,
        private readonly connections: ConnectionBindingsReadService,
        private readonly flows: BankFeedFlowService,
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
        if (credit.direction === "debit") return this.flows.debit(tx, connection, credit)
        const recorded = await this.flows.record(tx, connection, credit)
        const flowOwns = await this.flows.owns(connection.workspaceId, agent.id)
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
        if (flowOwns && recorded?.created === true) await this.flows.tag(tx, connection, agent.id, credit, recorded)
        return { status: "booked" }
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
