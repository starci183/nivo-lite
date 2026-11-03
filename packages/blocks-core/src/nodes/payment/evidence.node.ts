import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeContext, NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { scoreCandidates } from "@nivo-lite/agent-sdk/reconcile"
import type { Arrival, Candidate, Claim, Evidenced } from "@nivo-lite/agent-sdk/reconcile"
import { z } from "zod"
import {
    ARRIVAL_DINH,
    ARRIVAL_MOMO,
    ARRIVAL_NAMED,
    CLAIM_OF_DINH,
    EVIDENCED_FOR_DINH,
    EVIDENCED_FOR_MOMO,
    EVIDENCED_FOR_NAMED,
    STORE_EXTENDED,
    STORE_REAL_CASE,
    TRANSACTION_DINH,
    TRANSACTION_MOMO,
    TRANSACTION_NAMED,
    WINDOW_HOURS,
} from "./payment.fixtures"
import { READ_CLAIMS, READ_LEADS, READ_ORDERS, READ_TRANSACTIONS } from "./payment.rights"
import { AWAITING_PAYMENT, arrivalSchema, atOf, claimSchema, evidencedSchema } from "./payment.schemas"
import type { ClaimRow, LeadRow, OrderRow, PricedOrder, TransactionRow } from "./payment.schemas"

const HOUR_MS = 3_600_000
const READ_LIMIT = 200

/** Which transaction to gather the evidence for. */
interface EvidenceInput {
    readonly transactionId: string
}

/** The transaction as an arrival (null when it is not found), the candidates with their evidence, and the open claims. */
interface EvidenceOutput {
    readonly arrival: Arrival | null
    readonly evidenced: ReadonlyArray<Evidenced>
    readonly claims: ReadonlyArray<Claim>
}

/** How far back, before the transaction, an order may have been opened to be a candidate. */
interface EvidenceParams {
    readonly windowHours: number
}

const params: z.ZodType<EvidenceParams> = z.object({ windowHours: z.number().positive().default(72) })
const input: z.ZodType<EvidenceInput, EvidenceInput> = z.object({ transactionId: z.string() })
const output: z.ZodType<EvidenceOutput, EvidenceOutput> = z.object({
    arrival: arrivalSchema.nullable(),
    evidenced: z.array(evidencedSchema),
    claims: z.array(claimSchema),
})

const TRANSACTION_FIELDS = READ_TRANSACTIONS.fields
const ORDER_FIELDS = READ_ORDERS.fields
const CLAIM_FIELDS = READ_CLAIMS.fields

const arrivalOf = (row: TransactionRow): Arrival => ({
    id: row.id,
    amount: row.amountVnd,
    text: row.content,
    names: row.counterpartName === null ? [] : [row.counterpartName],
    at: atOf(row.receivedAt),
})

const candidateOf = (order: PricedOrder, name: string | null): Candidate => ({
    id: order.id,
    label: `${order.orderNo} · ${name ?? "—"}`,
    amountDue: order.amountVnd,
    partyName: name,
    partyKey: order.leadId,
    codes: [order.orderNo],
    openedAt: atOf(order.confirmedAt ?? order.createdAt),
})

const claimOf = (row: ClaimRow): Claim => ({
    id: row.id,
    partyKey: row.leadId,
    amount: row.amountVnd,
    names: row.names,
    text: row.body,
    at: atOf(row.claimedAt),
    status: "open",
})

/** The orders that wait for money and have an amount. */
const openOrders = async (context: NodeContext): Promise<ReadonlyArray<PricedOrder>> => {
    const lists = await Promise.all(
        AWAITING_PAYMENT.map((status) =>
            context.data.read<OrderRow>("order", { where: { status }, fields: ORDER_FIELDS, limit: READ_LIMIT }),
        ),
    )
    return lists.flat().filter((order): order is PricedOrder => order.amountVnd !== null)
}

/** The name of the customer of an order, read once per customer. */
const nameOf = async (context: NodeContext, leadId: string): Promise<string | null> => {
    const [lead] = await context.data.read<LeadRow>("sales-lead", {
        where: { id: leadId },
        fields: READ_LEADS.fields,
        limit: 1,
    })
    return lead?.contactName ?? null
}

/**
 * Gathers what a bank transaction is matched on: the transaction itself, the orders that wait for money and were opened inside the window
 * before it, with their customer's name, and what customers said about having paid. Every candidate comes back with the evidence checked
 * for it (code, amount, name, recency, claim) and a score; nothing is decided here.
 */
export const paymentEvidenceNode: NodeDefinition<
    z.ZodType<EvidenceInput, EvidenceInput>,
    z.ZodType<EvidenceOutput, EvidenceOutput>,
    z.ZodType<EvidenceParams>
> = defineNode({
    id: "payment.evidence",
    role: "execute",
    title: { key: "paymentEvidence" },
    params,
    input,
    output,
    rights: [READ_TRANSACTIONS, READ_ORDERS, READ_CLAIMS, READ_LEADS],
    effects: [],
    run: async (given, context) => {
        const [transaction] = await context.data.read<TransactionRow>("bank-transaction", {
            where: { id: given.transactionId },
            fields: TRANSACTION_FIELDS,
            limit: 1,
        })
        if (transaction === undefined) return { arrival: null, evidenced: [], claims: [] }
        const arrival = arrivalOf(transaction)
        const windowMs = context.params.windowHours * HOUR_MS
        const orders = (await openOrders(context)).filter(
            (order) => atOf(order.confirmedAt ?? order.createdAt) >= arrival.at - windowMs,
        )
        const candidates = await Promise.all(
            orders.map(async (order) => candidateOf(order, await nameOf(context, order.leadId))),
        )
        const claims = (
            await context.data.read<ClaimRow>("payment-claim", {
                where: { status: "open" },
                fields: CLAIM_FIELDS,
                limit: READ_LIMIT,
            })
        ).map(claimOf)
        return { arrival, evidenced: scoreCandidates(arrival, candidates, claims, { windowMs }), claims }
    },
    examples: [
        {
            name: "the 5,000 transfer at 01:06, twelve minutes after Định's claim: amount, name, claim and recency hold",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: TRANSACTION_DINH.id },
            output: { arrival: ARRIVAL_DINH, evidenced: [...EVIDENCED_FOR_DINH], claims: [CLAIM_OF_DINH] },
            effects: [],
            store: STORE_REAL_CASE,
        },
        {
            name: "the unrelated 2,000 MoMo transfer of the evening before: nothing holds for Định's order",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: TRANSACTION_MOMO.id },
            output: { arrival: ARRIVAL_MOMO, evidenced: [...EVIDENCED_FOR_MOMO], claims: [CLAIM_OF_DINH] },
            effects: [],
            store: STORE_REAL_CASE,
        },
        {
            name: "a named 7,000 payer and a second order of a customer nobody knows: the amount of the second order holds",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: TRANSACTION_NAMED.id },
            output: { arrival: ARRIVAL_NAMED, evidenced: [...EVIDENCED_FOR_NAMED], claims: [CLAIM_OF_DINH] },
            effects: [],
            store: STORE_EXTENDED,
        },
        {
            name: "a transaction that is not found has no evidence",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: "missing" },
            output: { arrival: null, evidenced: [], claims: [] },
            effects: [],
            store: STORE_REAL_CASE,
        },
    ],
})
