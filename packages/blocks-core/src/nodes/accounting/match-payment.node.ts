import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeContext, NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../bounds"
import { bilingualOf, messageOf, sampleOf } from "../../messages/catalog"
import { agentMessagePostEffect, channelSendEffect, paymentClaimRecordEffect } from "../../vocabulary"
import { TOOL } from "../../vocabulary/tool-ids"
import type { NodeSchema } from "../node-schema.types"
import { STORE_NOT_ARRIVED, STORE_OVER, STORE_REAL_CASE } from "../payment/payment.fixtures"
import { READ_CLAIMS, READ_LEADS, READ_ORDERS, READ_TRANSACTIONS } from "../payment/payment.rights"
import { AWAITING_PAYMENT, claimNamesOf } from "../payment/payment.schemas"
import type { ClaimRow, LeadRow, OrderRow, TransactionRow } from "../payment/payment.schemas"

/** How the money compares with what the order is due, read from the two records: the same, short of it, or more. */
export type PaymentVerdict = "exact" | "short" | "over"

/** Where the reconciliation goes after the match. */
export type MatchBranch = "matched" | "not-arrived" | "unmatched" | "held"

/** What woke the reconciliation: a bank transaction (SePay), or the customer's words that they paid (the front desk); each may be absent. */
export interface MatchPaymentInput {
    /** The bank transaction that arrived, or null when a customer's message started the run. */
    readonly transactionId: string | null
    /** The conversation the customer wrote in, or null. */
    readonly conversationId: string | null
    /** The customer's words, or null. */
    readonly text: string | null
    /** The customer, or null. */
    readonly leadId: string | null
}

/** What the agent of the step answers: which transfer pays which open order, whether to settle it now, and why; ids only, never an amount. */
interface MatchAnswer {
    readonly transactionId: string | null
    readonly orderId: string | null
    readonly claimId: string | null
    /** True when the order is to be marked paid with this transaction now; false to hold it (the founder said so, or the policy). */
    readonly settle: boolean
    readonly reason: string
}

/** What the step answers: the agent's match with the true numbers read back from the records. */
export interface MatchPaymentOutput extends MatchAnswer {
    /**
     * `matched`: a bank transaction pays the order and is to be settled now; the graph goes on to mark it paid. The other three are left
     * unrouted, so the turn ends there: `not-arrived` (the customer said they paid, no transaction shows it yet: the next SePay
     * transaction starts the reconciliation again), `unmatched` (money that pays no open order: the founder was asked on the team chat),
     * `held` (the money is this order's but is not settled now, as the policy or the founder decided).
     */
    readonly branch: MatchBranch
    /** The customer of the order, from the order record. */
    readonly leadId: string | null
    /** How the transfer compares with the order, from the two records; null while the money has not arrived. */
    readonly verdict: PaymentVerdict | null
    /** What the order is due, VND, from the order record. */
    readonly expectedVnd: number | null
    /** What arrived, VND, from the transaction record. */
    readonly receivedVnd: number | null
}

/** The input as a graph may bind it: every member may be left out. */
type MatchPaymentGiven = { readonly [Key in keyof MatchPaymentInput]?: MatchPaymentInput[Key] | undefined }

const READ_LIMIT = 50
/** The status of an order whose money arrived, and how many of the customer's paid orders the agent is shown. */
const PAID = "paid"
const PAID_SHOWN = 5
const MAX_TURNS = 4

const id = z.string().min(1).max(MAX_ID)

const input: NodeSchema<MatchPaymentInput, MatchPaymentGiven> = z.object({
    transactionId: id.nullable().default(null),
    conversationId: id.nullable().default(null),
    text: z.string().max(MAX_BODY).nullable().default(null),
    leadId: id.nullable().default(null),
})

const answerShape = {
    transactionId: id
        .nullable()
        .describe(
            "The id of the bank transaction that pays the order; null when the customer says they paid and no transaction shows it yet.",
        ),
    orderId: id.nullable().describe("The id of the open order the money is for; null when no order can be told."),
    claimId: id
        .nullable()
        .describe(
            "The id of the customer's payment claim this answers (the one recorded in this step, or an open one); null when none.",
        ),
    settle: z
        .boolean()
        .describe(
            "True when this transaction is to mark this order paid now (the amount is exact, or the policy or the founder's answer says to settle it); false to hold it.",
        ),
    reason: z
        .string()
        .min(1)
        .max(MAX_BODY)
        .describe("One line in Vietnamese for the team: why this transfer is this order's."),
}

const answer: NodeSchema<MatchAnswer> = z.object(answerShape)

const output: NodeSchema<MatchPaymentOutput> = z.object({
    ...answerShape,
    branch: z
        .enum(["matched", "not-arrived", "unmatched", "held"])
        .describe(
            "matched: settle the order with the transaction now. not-arrived: no transaction shows the customer's money yet. unmatched: the money pays no open order. held: the order's money, not settled now.",
        ),
    leadId: id.nullable().describe("The customer of the order, read from the order."),
    verdict: z
        .enum(["exact", "short", "over"])
        .nullable()
        .describe(
            "How the transfer compares with the order, read from the records; null while the money has not arrived.",
        ),
    expectedVnd: z.number().nullable().describe("What the order is due, VND, read from the order."),
    receivedVnd: z.number().nullable().describe("What arrived, VND, read from the transaction."),
})

/** The rows the agent decides on, read by code and handed over as facts. */
interface MatchFacts {
    readonly transactions: ReadonlyArray<TransactionRow>
    readonly orders: ReadonlyArray<OrderRow>
    readonly leads: ReadonlyArray<LeadRow>
    readonly claims: ReadonlyArray<ClaimRow>
    /** The customer's orders already paid, newest first: a customer may report a transfer the books already took. */
    readonly paidOrders: ReadonlyArray<OrderRow>
}

const read = <T>(context: NodeContext, kind: string, fields: ReadonlyArray<string>, where?: Record<string, string>) =>
    context.data.read<T>(kind, { fields, limit: READ_LIMIT, ...(where === undefined ? {} : { where }) })

/** The transaction that arrived, or, for a customer's word, the credits not yet tied to an order. */
const transactionsOf = (context: NodeContext, transactionId: string | null) =>
    read<TransactionRow>(
        context,
        "bank-transaction",
        READ_TRANSACTIONS.fields,
        transactionId === null ? { status: "unmatched" } : { id: transactionId },
    )

/**
 * The orders of the customer the run names that are paid already; none when the run names no customer. Read among the customer's
 * latest orders (an order is indexed by its customer and time, so a read pinned on the status too is one no index serves), the paid kept.
 */
const paidOrdersOf = async (context: NodeContext, leadId: string | null): Promise<ReadonlyArray<OrderRow>> =>
    leadId === null
        ? []
        : (await read<OrderRow>(context, "order", READ_ORDERS.fields, { leadId }))
              .filter((order) => order.status === PAID)
              .slice(0, PAID_SHOWN)

const factsOf = async (context: NodeContext, given: MatchPaymentInput): Promise<MatchFacts> => {
    const [transactions, orderLists, claims, paidOrders] = await Promise.all([
        transactionsOf(context, given.transactionId),
        Promise.all(AWAITING_PAYMENT.map((status) => read<OrderRow>(context, "order", READ_ORDERS.fields, { status }))),
        read<ClaimRow>(context, "payment-claim", READ_CLAIMS.fields, { status: "open" }),
        paidOrdersOf(context, given.leadId),
    ])
    const orders = orderLists.flat()
    const leadIds = [...new Set(orders.map((order) => order.leadId))]
    const leads = (
        await Promise.all(
            leadIds.map((leadId) => read<LeadRow>(context, "sales-lead", READ_LEADS.fields, { id: leadId })),
        )
    ).flat()
    return { transactions, orders, leads, claims, paidOrders }
}

/** The facts as the agent reads them: the claim names as a plain list, each order with its customer's name. */
const factsForAgent = (facts: MatchFacts) => ({
    transactions: facts.transactions.map(({ id: txId, amountVnd, reference, payer, occurredAt, orderId }) => ({
        id: txId,
        amountVnd,
        reference,
        payer,
        occurredAt,
        paidOrderId: orderId,
    })),
    openOrders: facts.orders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        amountVnd: order.amountVnd,
        customer: facts.leads.find((lead) => lead.id === order.leadId)?.contactName ?? null,
        leadId: order.leadId,
        confirmedAt: order.confirmedAt,
    })),
    openClaims: facts.claims.map((claim) => ({
        id: claim.id,
        leadId: claim.leadId,
        conversationId: claim.conversationId,
        saidAmountVnd: claim.amountVnd,
        names: claimNamesOf(claim.names),
        words: claim.body,
        claimedAt: claim.claimedAt,
    })),
    paidOrders: facts.paidOrders.map((order) => ({ id: order.id, orderNo: order.orderNo, amountVnd: order.amountVnd })),
})

const verdictOf = (receivedVnd: number, expectedVnd: number): PaymentVerdict => {
    if (receivedVnd === expectedVnd) return "exact"
    return receivedVnd < expectedVnd ? "short" : "over"
}

/** The route of the answer: no money yet, money for no open order, the order's money held, or settled now. */
const branchOf = (arrived: boolean, ordered: boolean, settle: boolean): MatchBranch => {
    if (!arrived) return "not-arrived"
    if (!ordered) return "unmatched"
    return settle ? "matched" : "held"
}

/** The reason of a run that found its transaction already settled: a fact the team reads, never a line to a customer. */
const SETTLED_REASON = "transaction_settled"

/**
 * The output of a run whose bank transaction already paid an order: a second run for the same credit (the rematch of a code issued
 * later, a repeated wake, the founder's own settle of money the first run asked about). Nothing is left to decide, so the agent is not
 * called, the founder is not asked again and the turn ends on `held` with the order the books already tied it to.
 */
const settledOutputOf = (transaction: TransactionRow): MatchPaymentOutput => ({
    transactionId: transaction.id,
    orderId: transaction.orderId,
    claimId: null,
    settle: false,
    reason: SETTLED_REASON,
    branch: "held",
    leadId: null,
    verdict: null,
    expectedVnd: null,
    receivedVnd: transaction.amountVnd,
})

/** An id the agent named that is not among the records it was given: never taken, the engine's AI core gets it. */
const unknownId = (what: string, value: string): Error => new Error(`MATCH_PAYMENT_UNKNOWN_${what}: ${value}`)

/** The agent's answer with the true numbers read back from the records it named. */
const outputOf = (decided: MatchAnswer, facts: MatchFacts): MatchPaymentOutput => {
    const order = decided.orderId === null ? undefined : facts.orders.find((one) => one.id === decided.orderId)
    if (decided.orderId !== null && order === undefined) throw unknownId("ORDER", decided.orderId)
    const transaction =
        decided.transactionId === null ? undefined : facts.transactions.find((one) => one.id === decided.transactionId)
    if (decided.transactionId !== null && transaction === undefined)
        throw unknownId("TRANSACTION", decided.transactionId)
    const expectedVnd = order?.amountVnd ?? null
    const receivedVnd = transaction?.amountVnd ?? null
    return {
        ...decided,
        branch: branchOf(transaction !== undefined, order !== undefined, decided.settle),
        leadId: order?.leadId ?? null,
        verdict: expectedVnd === null || receivedVnd === null ? null : verdictOf(receivedVnd, expectedVnd),
        expectedVnd,
        receivedVnd,
    }
}

const RIGHTS = [READ_TRANSACTIONS, READ_ORDERS, READ_CLAIMS, READ_LEADS]

/** The grant of the examples: the node's reads, and what recording a claim, speaking to the customer and to the team need. */
const GRANT: RightsGrant = {
    rights: [
        ...RIGHTS,
        ...paymentClaimRecordEffect.rights,
        ...channelSendEffect.rights,
        ...agentMessagePostEffect.rights,
    ],
}

const REASON_DINH = sampleOf("sampleTenSoTienVaLoiBao2")

/**
 * `accounting.match-payment` (Khớp tiền với đơn): the agent of the step decides what the money is for and whether to settle it now, from
 * the money that arrived (or the customer's words that they paid), the open orders with what each is due, the customer's paid orders and
 * the open claims, all read here as facts. A customer's word is recorded as a claim (`TOOL.paymentClaimRecord`, never proof) unless one of
 * their paid orders already took the money. Short or over money is judged HERE, from the policy; with no rule the agent asks the founder
 * (`confused`) and the step runs again with the answer. Money that pays no open order is put to the founder on the team chat. It answers
 * ids only; the numbers and the verdict are read back from the records. Only `matched` is routed (to Đánh dấu đã trả); `not-arrived`,
 * `unmatched` and `held` end the turn.
 */
export const accountingMatchPaymentNode: NodeDefinition<
    NodeSchema<MatchPaymentInput, MatchPaymentGiven>,
    NodeSchema<MatchPaymentOutput>,
    z.ZodObject<Record<string, never>>
> = defineNode({
    id: "accounting.match-payment",
    role: "execute",
    title: bilingualOf("nodeAccountingMatchPaymentTitle"),
    params: z.object({}),
    input,
    output,
    rights: RIGHTS,
    effects: [TOOL.paymentClaimRecord, TOOL.customerMessageSend, TOOL.teamMessagePost],
    run: async (given, context) => {
        const facts = await factsOf(context, given)
        const settled =
            given.transactionId === null ? undefined : facts.transactions.find((one) => one.orderId !== null)
        if (settled !== undefined) return settledOutputOf(settled)
        const decision = await context.agent.run({
            goal: messageOf("en", "nodeAccountingMatchPaymentGoal"),
            input: { trigger: given, ...factsForAgent(facts) },
            output: answer,
            maxTurns: MAX_TURNS,
        })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        return outputOf(decision.value, facts)
    },
    examples: [
        {
            name: "SePay: Dinh's 5,000 with no order code pays his 5,000 order, his open claim answered",
            grant: GRANT,
            params: {},
            input: { transactionId: "tx-95958515" },
            store: STORE_REAL_CASE,
            model: [
                {
                    done: {
                        transactionId: "tx-95958515",
                        orderId: "order-dinh",
                        claimId: "claim-dinh",
                        settle: true,
                        reason: REASON_DINH,
                    },
                },
            ],
            output: {
                branch: "matched",
                transactionId: "tx-95958515",
                orderId: "order-dinh",
                claimId: "claim-dinh",
                settle: true,
                reason: REASON_DINH,
                leadId: "lead-dinh",
                verdict: "exact",
                expectedVnd: 5000,
                receivedVnd: 5000,
            },
            effects: [],
        },
        {
            name: "a customer says they paid and no money has arrived: the claim is recorded, the turn waits for SePay",
            grant: GRANT,
            params: {},
            input: {
                conversationId: "conversation-dinh",
                text: sampleOf("sampleToiDaChuyenKhoan5kTen"),
                leadId: "lead-dinh",
            },
            store: STORE_NOT_ARRIVED,
            model: [
                {
                    call: {
                        tool: TOOL.paymentClaimRecord,
                        args: {
                            leadId: "lead-dinh",
                            conversationId: "conversation-dinh",
                            amountVnd: 5000,
                            names: ["BUI NGUYEN DINH"],
                            body: sampleOf("sampleToiDaChuyenKhoan5kTen"),
                        },
                    },
                },
                {
                    done: {
                        transactionId: null,
                        orderId: "order-dinh",
                        claimId: "payment-claim.record-1",
                        settle: false,
                        reason: REASON_DINH,
                    },
                },
            ],
            output: {
                branch: "not-arrived",
                transactionId: null,
                orderId: "order-dinh",
                claimId: "payment-claim.record-1",
                settle: false,
                reason: REASON_DINH,
                leadId: "lead-dinh",
                verdict: null,
                expectedVnd: 5000,
                receivedVnd: null,
            },
            effects: [TOOL.paymentClaimRecord],
        },
        {
            name: "a customer says they paid, no money yet: the claim is recorded and the agent tells them the shop is checking",
            grant: GRANT,
            params: {},
            input: {
                conversationId: "conversation-dinh",
                text: sampleOf("sampleToiDaChuyenKhoan5kTen"),
                leadId: "lead-dinh",
            },
            store: STORE_NOT_ARRIVED,
            model: [
                {
                    call: {
                        tool: TOOL.paymentClaimRecord,
                        args: {
                            leadId: "lead-dinh",
                            conversationId: "conversation-dinh",
                            amountVnd: 5000,
                            names: ["BUI NGUYEN DINH"],
                            body: sampleOf("sampleToiDaChuyenKhoan5kTen"),
                        },
                    },
                },
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: { conversationId: "conversation-dinh", text: sampleOf("sampleEmDangKiemTraGiaoDich") },
                    },
                },
                {
                    done: {
                        transactionId: null,
                        orderId: "order-dinh",
                        claimId: "payment-claim.record-1",
                        settle: false,
                        reason: REASON_DINH,
                    },
                },
            ],
            output: {
                branch: "not-arrived",
                transactionId: null,
                orderId: "order-dinh",
                claimId: "payment-claim.record-1",
                settle: false,
                reason: REASON_DINH,
                leadId: "lead-dinh",
                verdict: null,
                expectedVnd: 5000,
                receivedVnd: null,
            },
            effects: [TOOL.paymentClaimRecord, TOOL.customerMessageSend],
        },
        {
            name: "the owner's test: 2,000 for the 1,000 order named in the content is that order's, over by the records",
            grant: GRANT,
            params: {},
            input: { transactionId: "tx-over" },
            store: STORE_OVER,
            model: [
                {
                    done: {
                        transactionId: "tx-over",
                        orderId: "order-test",
                        claimId: null,
                        settle: true,
                        reason: REASON_DINH,
                    },
                },
            ],
            output: {
                branch: "matched",
                transactionId: "tx-over",
                orderId: "order-test",
                claimId: null,
                settle: true,
                reason: REASON_DINH,
                leadId: "lead-dinh",
                verdict: "over",
                expectedVnd: 1000,
                receivedVnd: 2000,
            },
            effects: [],
        },
    ],
})
