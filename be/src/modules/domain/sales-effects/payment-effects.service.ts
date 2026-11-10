import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { TOOL, refusalOf } from "@nivo-lite/blocks-core"
import type { EffectFact, EffectFacts } from "@nivo-lite/blocks-core"
import { settleOnOrder } from "@nivo-lite/blocks-core/modules/accounting"
import type { SettlePorts } from "@nivo-lite/blocks-core/modules/accounting"
import { AWAITING_PAYMENT_STATUSES } from "@nivo-lite/blocks-core/rules/sales"
import type { EntitiesApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import type { EffectCall, EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { RunIn } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { SalesEffectsError, SalesEffectsErrorCode } from "./errors/sales-effects.error"
import { isRecordId, payloadOf } from "./sales-effects.policy"
import { claimRecordSchema, markPaidSchema, voidSchema } from "./sales-effects.schema"

const CLAIM = "payment.claim"
const ORDER = "sales.order"
const TRANSACTION = "payment.transaction"

/** The statuses a claim is closed in: withdrawing it again changes nothing. */
const CLAIM_CLOSED: ReadonlySet<string> = new Set(["withdrawn", "settled"])

/** The statuses a claim still waits in: the settlement of its order answers it. */
const CLAIM_OPEN: ReadonlyArray<string> = ["open", "escalated"]

/** The most orders awaiting payment of a customer listed as candidates for a claim. */
const AWAITING_ORDERS_LISTED = 20

/** The most claims of a customer looked at to find those linked to an order. */
const CLAIMS_LOOKED_AT = 50

const orderSubject = (id: string): EffectFact => ({ kind: "order", id })

/** The members of a value when it is a record; none otherwise. */
const entriesOf = (value: unknown): ReadonlyArray<readonly [string, unknown]> =>
    typeof value === "object" && value !== null ? Object.entries(value) : []

/** A fact under its name when the record holds it as a text or a number (the engine may answer money as text); nothing otherwise. */
const factOf = (name: string, value: unknown): EffectFacts => {
    if (typeof value === "number") return { [name]: value }
    if (typeof value !== "string" || value === "") return {}
    return name.endsWith("Vnd") && Number.isFinite(Number(value)) ? { [name]: Number(value) } : { [name]: value }
}

/** The refusal the books gave as a fact: the reason (`data.reason`) and the true values beside it. */
const settleRefusalOf = (data: unknown): EffectFact => {
    const entries = entriesOf(data)
    const reason = entries.find(([name]) => name === "reason")?.[1]
    const facts = entries
        .filter(([name]) => name !== "reason")
        .reduce<EffectFacts>((kept, [name, value]) => ({ ...kept, ...factOf(name, value) }), {})
    return refusalOf(typeof reason === "string" ? reason : "refused", facts)
}

/** The signal a refused settlement leaves its transaction with, so the transaction rolls back; it carries the fact to answer. */
class SettleRefused extends Error {
    constructor(readonly fact: EffectFact) {
        super("settle refused")
    }
}

const claimSubject = (id: string): EffectFact => ({ kind: "payment-claim", id })

@Injectable()
/**
 * The executors of the payment effects on the entity engine, each in one workspace-scoped transaction.
 * - `payment.order.settle` settles the order with the bank transaction through the same path as `payment.settle` (`settleOnOrder`): the
 *   transaction matched and linked to the order, the order paid and the book entry enqueued. No notice job and no ledger job: the
 *   workflow thanks the customer and writes the ledger line in its own steps. A transaction that already paid the order changes nothing.
 *   The claim it answers is the one the agent names (`claimId`), else every open claim linked to that order; a claim linked to no order
 *   is never closed by a guess.
 *   This executor is the hard guard of "paid": only a real, unused bank credit settles an open, priced order, never anything an agent
 *   says. The amount is no guard: whatever the credit brought, the order is paid with it and the books keep the amount really received;
 *   the answer carries what was due, what arrived and the difference (negative short, positive over) for the agent to report. A missing
 *   or used transaction, a missing, closed or unpriced order is a refusal fact (`refused`, the reason, the true values) with nothing
 *   written.
 * - `payment.claim.record` stores what the customer said they paid as an open claim, tied to the conversation and, only when the agent
 *   names the order (`orderId`, which must be the customer's own), to that order; once per dedupe key. When no order is named the
 *   answer lists the customer's orders awaiting payment (id, number, amount) as facts, for the agent to choose from.
 * - `payment.claim.cancel` closes a claim a failed run recorded; a claim that is gone, withdrawn or settled changes nothing.
 */
export class PaymentEffectsService implements OnModuleInit {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executors when the app hosts graph nodes. */
    onModuleInit(): void {
        this.registry?.addExecutor({
            effect: TOOL.paymentMarkPaid,
            execute: (turn, payload) => this.markPaid(turn, payload),
        })
        this.registry?.addExecutor({
            effect: TOOL.paymentClaimRecord,
            execute: (turn, payload, call) => this.recordClaim(turn, payload, call),
        })
        this.registry?.addExecutor({
            effect: TOOL.paymentClaimWithdraw,
            execute: (turn, payload) => this.withdrawClaim(turn, payload),
        })
    }

    /**
     * Settles the order with the bank credit, or answers why not. A refusal of the books is a fact for the caller (`refused`, the reason
     * and the true amounts of the two records); it leaves the transaction through a private signal, so a refusal that came after a first
     * write (another writer took the order or the credit meanwhile) rolls every write back before it is answered.
     */
    private async markPaid(turn: NodeTurn, payload: EffectPayload): Promise<EffectFact> {
        const given = payloadOf(markPaidSchema, payload)
        if (!isRecordId(given.orderId)) return refusalOf("order_missing")
        if (!isRecordId(given.transactionId)) return refusalOf("transaction_missing")
        try {
            return await this.engine.scoped(turn.workspaceId, async (tx) => {
                const runIn: RunIn = (use) => use(tx)
                const ports: SettlePorts = {
                    transactions: this.ports.entityApi(runIn, "action", TRANSACTION),
                    orders: this.ports.entityApi(runIn, "action", ORDER),
                    claims: this.ports.entityApi(runIn, "action", CLAIM),
                    outbox: this.ports.outboxApi(runIn),
                }
                const [claimId = null, ...others] =
                    given.claimId === undefined
                        ? await this.linkedClaimsOf(this.ports.entitiesApi(runIn, "action"), given.orderId)
                        : [given.claimId]
                const settled = await settleOnOrder(
                    ports,
                    { transactionId: given.transactionId, orderId: given.orderId, claimId },
                    { notice: false, ledger: false },
                )
                if (settled.ok) {
                    await this.answerClaims(ports, others, given.transactionId)
                    return await this.paidFact(ports, given, settled.data)
                }
                if (settled.reason !== "refused") {
                    throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
                }
                throw new SettleRefused(settleRefusalOf(settled.data))
            })
        } catch (cause) {
            if (cause instanceof SettleRefused) return cause.fact
            throw cause
        }
    }

    /**
     * The fact of a settlement that stands: the order, whether this call paid it, and the amounts of the two records — what the order is
     * due, what the bank credit really brought and the difference (negative short, positive over), so the agent reports it as it is.
     */
    private async paidFact(
        ports: SettlePorts,
        given: { readonly orderId: string; readonly transactionId: string },
        data: unknown,
    ): Promise<EffectFact> {
        const [order, transaction] = await Promise.all([
            ports.orders.get(given.orderId),
            ports.transactions.get(given.transactionId),
        ])
        const already = entriesOf(data).some(([name, value]) => name === "result" && value === "already-paid")
        const expected = factOf("expectedVnd", order?.data.amountVnd)
        const received = factOf("receivedVnd", transaction?.data.amountVnd)
        const difference =
            typeof expected.expectedVnd === "number" && typeof received.receivedVnd === "number"
                ? { differenceVnd: received.receivedVnd - expected.expectedVnd }
                : {}
        return {
            ...orderSubject(given.orderId),
            facts: {
                result: already ? "already_paid" : "paid",
                transactionId: given.transactionId,
                ...factOf("orderNo", order?.data.orderNo),
                ...expected,
                ...received,
                ...difference,
            },
        }
    }

    private async recordClaim(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<EffectFact> {
        const given = payloadOf(claimRecordSchema, payload)
        if (!isRecordId(given.conversationId))
            throw new SalesEffectsError({ code: SalesEffectsErrorCode.ConversationNotFound })
        const leadId = given.leadId !== null && isRecordId(given.leadId) ? given.leadId : null
        const dedupeKey = call.dedupeKey ?? call.key
        return await this.inScope(turn, async (api) => {
            const standing = await this.claimByKey(api, dedupeKey)
            if (standing !== null) return claimSubject(standing.id)
            const named = given.orderId === undefined ? null : await this.orderOfCustomer(api, given.orderId, leadId)
            if (named !== null && "refused" in named) return named.refused
            const orderId = named === null ? null : named.id
            const awaiting = orderId === null && leadId !== null ? await this.awaitingOrdersOf(api, leadId) : []
            const made = await api.insert(
                CLAIM,
                {
                    leadId,
                    conversationId: given.conversationId,
                    amountVnd: given.amountVnd ?? null,
                    names: { values: given.names },
                    body: given.body,
                    status: "open",
                    claimedAt: this.clock.now().toISOString(),
                    dedupeKey,
                },
                { conversation: given.conversationId, ...(orderId === null ? {} : { order: orderId }) },
            )
            if (made.ok) {
                return {
                    ...claimSubject(made.row.id),
                    facts: { orderId, ...(orderId === null ? { awaitingOrders: awaiting } : {}) },
                }
            }
            const raced = made.reason === "taken" ? await this.claimByKey(api, dedupeKey) : null
            if (raced === null) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
            return claimSubject(raced.id)
        })
    }

    private async withdrawClaim(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const { id } = payloadOf(voidSchema, payload)
        return await this.inScope(turn, async (api) => {
            const claim = isRecordId(id) ? await api.get(CLAIM, id) : null
            if (claim === null || CLAIM_CLOSED.has(String(claim.data.status))) return claimSubject(id)
            const written = await api.update(CLAIM, claim.id, claim.version, { status: "withdrawn" })
            if (!written.ok) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
            return claimSubject(id)
        })
    }

    /**
     * The open or escalated claims linked to an order, newest first: the claims the agent tied to it when it recorded them. A claim of
     * the same customer that was tied to another order, or to none, is not among them.
     */
    private async linkedClaimsOf(api: EntitiesApi, orderId: string): Promise<ReadonlyArray<string>> {
        const order = await api.get(ORDER, orderId)
        const leadId = order?.data.leadId
        if (typeof leadId !== "string") return []
        const page = await api.list({
            from: CLAIM,
            select: ["status"],
            join: { order: [] },
            where: q.and(q.eq("leadId", leadId), q.in("status", [...CLAIM_OPEN])),
            order: [
                ["claimedAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: CLAIMS_LOOKED_AT },
        })
        return page.rows.filter((listed) => listed.joined.order?.id === orderId).map((listed) => listed.row.id)
    }

    /** Closes the claims a settlement also answered, in the transaction of the settlement. */
    private async answerClaims(
        ports: SettlePorts,
        claimIds: ReadonlyArray<string>,
        transactionId: string,
    ): Promise<void> {
        for (const id of claimIds) {
            const claim = await ports.claims.get(id)
            if (claim === null || !CLAIM_OPEN.includes(String(claim.data.status))) continue
            const answered = await ports.claims.update(claim.id, claim.version, {
                status: "settled",
                settledTransactionId: transactionId,
            })
            if (!answered.ok) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
        }
    }

    /** The claim already recorded under a dedupe key, or null. */
    private async claimByKey(api: EntitiesApi, dedupeKey: string): Promise<RecordRow | null> {
        const page = await api.list({
            from: CLAIM,
            select: ["status"],
            where: q.eq("dedupeKey", dedupeKey),
            order: [["id", "asc"]],
            page: { size: 1 },
        })
        return page.rows[0]?.row ?? null
    }

    /** The customer's orders that await payment, newest first, as facts: id, number and amount. */
    private async awaitingOrdersOf(api: EntitiesApi, leadId: string): Promise<ReadonlyArray<EffectFacts>> {
        const page = await api.list({
            from: ORDER,
            select: ["orderNo", "amountVnd", "status"],
            where: q.and(q.eq("leadId", leadId), q.in("status", [...AWAITING_PAYMENT_STATUSES])),
            order: [
                ["createdAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: AWAITING_ORDERS_LISTED },
        })
        return page.rows.map(({ row }) => ({
            orderId: row.id,
            ...factOf("orderNo", row.data.orderNo),
            ...factOf("amountVnd", row.data.amountVnd),
        }))
    }

    /** The order the agent named for a claim: the customer's own, or the refusal that says it is not. */
    private async orderOfCustomer(
        api: EntitiesApi,
        orderId: string,
        leadId: string | null,
    ): Promise<RecordRow | { readonly refused: EffectFact }> {
        const order = isRecordId(orderId) ? await api.get(ORDER, orderId) : null
        if (order === null) return { refused: refusalOf("order_missing") }
        if (leadId === null || order.data.leadId !== leadId) {
            return { refused: refusalOf("order_not_of_customer", { orderId }) }
        }
        return order
    }

    /** Runs the effect in one transaction scoped to the workspace of the turn. */
    private inScope<T>(turn: NodeTurn, work: (api: EntitiesApi) => Promise<T>): Promise<T> {
        return this.engine.scoped(turn.workspaceId, (tx) => work(this.ports.entitiesApi((use) => use(tx), "action")))
    }
}
