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
import { eachInOrder } from "@modules/platform/primitives"
import { BankCreditQueue, isBankCreditPayload } from "@modules/queues/bank-credit"
import { SIMULATED_BANK, simulatedBankEventId, simulatedCreditOf } from "./bank.policy"
import { InjectBillingOptions } from "./billing.decorators"
import type { BillingOptions } from "./billing.options"
import type {
    CassoDelivery,
    IncomingCredit,
    ManualCredit,
    PayosDelivery,
    ProvenConnection,
    SepayFeedDelivery,
    SimulatedDelivery,
} from "./billing.contracts"
import { cassoCredits, isCassoError } from "./casso.policy"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"
import { payosBodyOf, readPayosDelivery } from "./payos.policy"
import type { AgentIdRow, ConnectionStateRow } from "./persistence/bank-feed.rows"
import {
    MARK_CONNECTION_FED,
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
 * Books the credits a payment connection reports. Every intake proves its delivery as its first statement; a proven credit
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
        await this.entityManager.transaction((tx) =>
            this.book(tx, {
                workspaceId,
                amount: credit.amount,
                content: credit.content,
                sender: credit.sender,
                eventId: simulatedBankEventId(credit.eventId),
                bankName: SIMULATED_BANK.name,
                origin: "simulated",
            }),
        )
    }

    /** A Casso delivery: every positive transaction is a credit, a delivery Casso marks as an error is ignored. */
    async acceptCassoDelivery(delivery: CassoDelivery): Promise<void> {
        const proven = await this.proof.proveCasso(delivery)
        if (isCassoError(proven.body)) return
        await eachInOrder(cassoCredits(proven.body), (credit) =>
            this.feed(proven.connection, {
                amount: credit.amount,
                content: credit.content,
                eventId: credit.eventId,
                fallbackBankName: credit.bankName,
            }),
        )
    }

    /** A payOS delivery: a paid order is a credit; the confirmation ping and unpaid deliveries are acknowledged only. */
    async acceptPayosDelivery(delivery: PayosDelivery): Promise<void> {
        const proof = await this.proof.provePayos(delivery)
        if (proof.kind === "sample") return
        const reading = readPayosDelivery(payosBodyOf(proof.body))
        if (reading.kind === "ignored") return
        await this.feed(proof.connection, {
            amount: reading.amount,
            content: reading.content,
            eventId: reading.eventId,
            fallbackBankName: "payOS",
        })
    }

    /** Proves a workspace's SePay feed key against its connection's stored digest before the HTTP door admits intake. */
    async verifySepayFeedDelivery(delivery: SepayFeedDelivery): Promise<void> {
        await this.proof.proveSepayFeed(delivery)
    }

    /** A delivery of a workspace's own SePay feed: an incoming transfer with an amount is a credit. */
    async acceptSepayFeedDelivery(delivery: SepayFeedDelivery): Promise<void> {
        const proven = await this.proof.proveSepayFeed(delivery)
        const payload = sepayPayloadOf(proven.body)
        const amount = payload.transferAmount
        if (payload.transferType !== "in" || amount === undefined || amount <= 0) return
        await this.feed(proven.connection, {
            amount,
            content: (payload.content ?? payload.description ?? payload.code ?? "").trim(),
            eventId: `sepay:${payload.id}`,
            fallbackBankName: payload.gateway ?? "SePay",
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
    private feed(connection: ProvenConnection, credit: IncomingCredit): Promise<void> {
        return this.entityManager.transaction(async (tx) => {
            const at = this.clock.now()
            const [state] = await tx.query<Array<ConnectionStateRow>>(SELECT_CONNECTION_STATE, [
                connection.connectionId,
            ])
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
                    content: [booking.content || "—", booking.note ?? ""].filter((part) => part !== "").join(" - "),
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
