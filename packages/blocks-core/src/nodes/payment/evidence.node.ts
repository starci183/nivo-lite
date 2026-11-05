import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeContext, NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { scoreCandidates } from "@nivo-lite/agent-sdk/reconcile"
import type { Arrival, Candidate, Claim, Evidenced } from "@nivo-lite/agent-sdk/reconcile"
import { z } from "zod"
import { bestTransaction } from "./evidence.policy"
import {
    ARRIVAL_DINH,
    ARRIVAL_MOMO,
    ARRIVAL_NAMED,
    CLAIM_DINH,
    CLAIM_MOMO,
    CLAIM_OF_DINH,
    CLAIM_OF_MOMO,
    EVIDENCED_FOR_DINH,
    EVIDENCED_FOR_MOMO,
    EVIDENCED_FOR_MOMO_CLAIM,
    EVIDENCED_FOR_NAMED,
    STORE_EXTENDED,
    STORE_MOMO_CLAIM,
    STORE_REAL_CASE,
    TRANSACTION_DINH,
    TRANSACTION_MOMO,
    TRANSACTION_NAMED,
    WINDOW_HOURS,
} from "./payment.fixtures"
import { READ_CLAIMS, READ_CONVERSATIONS, READ_LEADS, READ_ORDERS, READ_TRANSACTIONS } from "./payment.rights"
import { AWAITING_PAYMENT, arrivalSchema, atOf, claimSchema, evidencedSchema } from "./payment.schemas"
import type { ClaimRow, ConversationRow, LeadRow, OrderRow, PricedOrder, TransactionRow } from "./payment.schemas"
import { MAX_ENTRIES, MAX_ID } from "../../bounds"

const HOUR_MS = 3_600_000
const READ_LIMIT = 200

/** What to gather the evidence for: a bank transaction that arrived, or a claim of a customer that says they paid. Exactly one is given. */
type EvidenceInput =
    | { readonly transactionId: string; readonly claimId: null }
    | { readonly transactionId: null; readonly claimId: string }

/**
 * The transaction as an arrival (null when none is found), the candidates with their evidence, the open claims (the one asked for first),
 * the transaction the evidence is for, and the claim it answers (the one asked for, else the oldest open claim).
 */
interface EvidenceOutput {
    readonly arrival: Arrival | null
    readonly evidenced: ReadonlyArray<Evidenced>
    readonly claims: ReadonlyArray<Claim>
    readonly transactionId: string | null
    readonly claimId: string | null
}

/** How far back, before the transaction, an order may have been opened to be a candidate; and how far around a claim a transaction may lie. */
interface EvidenceParams {
    readonly windowHours: number
}

const params: z.ZodType<EvidenceParams> = z.object({ windowHours: z.number().positive().default(72) })
const input: z.ZodType<EvidenceInput, EvidenceInput> = z.union([
    z.object({ transactionId: z.string().min(1).max(MAX_ID), claimId: z.null() }),
    z.object({ transactionId: z.null(), claimId: z.string().min(1).max(MAX_ID) }),
])
const output: z.ZodType<EvidenceOutput, EvidenceOutput> = z.object({
    arrival: arrivalSchema.nullable(),
    evidenced: z.array(evidencedSchema).max(MAX_ENTRIES),
    claims: z.array(claimSchema).max(MAX_ENTRIES),
    transactionId: z.string().max(MAX_ID).nullable(),
    claimId: z.string().max(MAX_ID).nullable(),
})

const NONE: EvidenceOutput = { arrival: null, evidenced: [], claims: [], transactionId: null, claimId: null }

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

/** A claim of the customer: of their record, or of their conversation while they are still nobody's lead. */
const claimOf = (row: ClaimRow): Claim => ({
    id: row.id,
    partyKey: row.leadId ?? `conversation:${row.conversationId ?? row.id}`,
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
            context.data.read<OrderRow>("order", { where: { status }, fields: READ_ORDERS.fields, limit: READ_LIMIT }),
        ),
    )
    return lists.flat().filter((order): order is PricedOrder => order.amountVnd !== null)
}

/** The name of the customer, or null when there is no such record. */
const nameOf = async (context: NodeContext, leadId: string): Promise<string | null> => {
    const [lead] = await context.data.read<LeadRow>("sales-lead", {
        where: { id: leadId },
        fields: READ_LEADS.fields,
        limit: 1,
    })
    return lead?.contactName ?? null
}

const openClaims = (context: NodeContext): Promise<ReadonlyArray<ClaimRow>> =>
    context.data.read<ClaimRow>("payment-claim", {
        where: { status: "open" },
        fields: READ_CLAIMS.fields,
        limit: READ_LIMIT,
    })

/** The candidates of an arrival: the orders that wait for money and were opened inside the window, of one customer or of everyone. */
const candidatesOf = async (
    context: NodeContext,
    arrival: Arrival,
    windowMs: number,
    leadId: string | null,
): Promise<ReadonlyArray<Candidate>> => {
    const orders = (await openOrders(context)).filter(
        (order) =>
            (leadId === null || order.leadId === leadId) &&
            atOf(order.confirmedAt ?? order.createdAt) >= arrival.at - windowMs,
    )
    return Promise.all(orders.map(async (order) => candidateOf(order, await nameOf(context, order.leadId))))
}

/** Everything the evidence is made of for an arrival, once its candidates and the claim it answers are known. */
const evidenceOf = (
    arrival: Arrival,
    candidates: ReadonlyArray<Candidate>,
    rows: ReadonlyArray<ClaimRow>,
    asked: string | null,
    windowMs: number,
): EvidenceOutput => {
    const claims = rows.map(claimOf).toSorted((left, right) => Number(right.id === asked) - Number(left.id === asked))
    return {
        arrival,
        evidenced: scoreCandidates(arrival, candidates, claims, { windowMs }),
        claims,
        transactionId: arrival.id,
        claimId: asked ?? claims[0]?.id ?? null,
    }
}

/** The evidence for a transaction that arrived: every open order inside the window, and what customers said about paying. */
const fromTransaction = async (
    context: NodeContext,
    transactionId: string,
    windowMs: number,
): Promise<EvidenceOutput> => {
    const [transaction] = await context.data.read<TransactionRow>("bank-transaction", {
        where: { id: transactionId },
        fields: READ_TRANSACTIONS.fields,
        limit: 1,
    })
    if (transaction === undefined) return NONE
    const arrival = arrivalOf(transaction)
    return evidenceOf(
        arrival,
        await candidatesOf(context, arrival, windowMs, null),
        await openClaims(context),
        null,
        windowMs,
    )
}

/** The lead of a claim: its own, or the one of its conversation. */
const leadOf = async (context: NodeContext, claim: ClaimRow): Promise<string | null> => {
    if (claim.leadId !== null || claim.conversationId === null) return claim.leadId
    const [conversation] = await context.data.read<ConversationRow>("conversation", {
        where: { id: claim.conversationId },
        fields: READ_CONVERSATIONS.fields,
        limit: 1,
    })
    return conversation?.leadId ?? null
}

/** The unmatched transactions of the feed that could be the money of a claim: of its amount when it names one, else the newest. */
const feedFor = (context: NodeContext, claim: ClaimRow): Promise<ReadonlyArray<TransactionRow>> =>
    context.data.read<TransactionRow>("bank-transaction", {
        where: claim.amountVnd === null ? { status: "unmatched" } : { amountVnd: claim.amountVnd },
        fields: READ_TRANSACTIONS.fields,
        limit: READ_LIMIT,
    })

/**
 * The evidence for a customer's claim: the transaction of the feed that most likely is their money (by amount when they named one, by the
 * name on the transfer, and by time), and the open orders of that customer's conversation. With no such transaction yet the claim has no
 * arrival and no candidates: it waits for the money.
 */
const fromClaim = async (context: NodeContext, claimId: string, windowMs: number): Promise<EvidenceOutput> => {
    const [claim] = await context.data.read<ClaimRow>("payment-claim", {
        where: { id: claimId },
        fields: READ_CLAIMS.fields,
        limit: 1,
    })
    if (claim?.status !== "open") return NONE
    const leadId = await leadOf(context, claim)
    const leadName = leadId === null ? null : await nameOf(context, leadId)
    const transaction = bestTransaction(claim, leadName, await feedFor(context, claim), windowMs)
    const rows = (await openClaims(context)).map((row) => (row.id === claim.id ? { ...row, leadId } : row))
    if (transaction === undefined) return { ...NONE, claims: rows.map(claimOf), claimId: claim.id }
    const arrival = arrivalOf(transaction)
    const candidates = leadId === null ? [] : await candidatesOf(context, arrival, windowMs, leadId)
    return evidenceOf(arrival, candidates, rows, claim.id, windowMs)
}

/**
 * Gathers what a payment is matched on, from a bank transaction that arrived or from a claim of a customer. From a transaction: the
 * transaction itself, the orders that wait for money and were opened inside the window before it, with their customer's name, and what
 * customers said about having paid. From a claim: the transaction of the feed that is most likely their money and the open orders of their
 * conversation. Every candidate comes back with the evidence checked for it (code, amount, name, recency, claim) and a score; nothing is
 * decided here.
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
    rights: [READ_TRANSACTIONS, READ_ORDERS, READ_CLAIMS, READ_LEADS, READ_CONVERSATIONS],
    effects: [],
    run: (given, context) => {
        const windowMs = context.params.windowHours * HOUR_MS
        return given.transactionId === null
            ? fromClaim(context, given.claimId, windowMs)
            : fromTransaction(context, given.transactionId, windowMs)
    },
    examples: [
        {
            name: "the 5,000 transfer at 01:06, twelve minutes after Dinh's claim: amount, name, claim and recency hold",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: TRANSACTION_DINH.id, claimId: null },
            output: {
                arrival: ARRIVAL_DINH,
                evidenced: [...EVIDENCED_FOR_DINH],
                claims: [CLAIM_OF_DINH],
                transactionId: TRANSACTION_DINH.id,
                claimId: CLAIM_DINH.id,
            },
            effects: [],
            store: STORE_REAL_CASE,
        },
        {
            name: "the claim at 00:54 before the money: its transaction is found in the feed, with the orders of his conversation",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: null, claimId: CLAIM_DINH.id },
            output: {
                arrival: ARRIVAL_DINH,
                evidenced: [...EVIDENCED_FOR_DINH],
                claims: [CLAIM_OF_DINH],
                transactionId: TRANSACTION_DINH.id,
                claimId: CLAIM_DINH.id,
            },
            effects: [],
            store: STORE_REAL_CASE,
        },
        {
            name: "the unrelated 2,000 MoMo transfer of the evening before: nothing holds for Dinh's order",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: TRANSACTION_MOMO.id, claimId: null },
            output: {
                arrival: ARRIVAL_MOMO,
                evidenced: [...EVIDENCED_FOR_MOMO],
                claims: [CLAIM_OF_DINH],
                transactionId: TRANSACTION_MOMO.id,
                claimId: CLAIM_DINH.id,
            },
            effects: [],
            store: STORE_REAL_CASE,
        },
        {
            name: "the owner's claim of 2,000 with a MoMo receipt finds transaction 95937289; the amount and the claim hold but no order is for 2,000",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: null, claimId: CLAIM_MOMO.id },
            output: {
                arrival: ARRIVAL_MOMO,
                evidenced: [...EVIDENCED_FOR_MOMO_CLAIM],
                claims: [CLAIM_OF_MOMO],
                transactionId: TRANSACTION_MOMO.id,
                claimId: CLAIM_MOMO.id,
            },
            effects: [],
            store: STORE_MOMO_CLAIM,
        },
        {
            name: "a claim whose money is not in the feed yet has no arrival and no candidates: it waits",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: null, claimId: CLAIM_DINH.id },
            output: {
                arrival: null,
                evidenced: [],
                claims: [CLAIM_OF_DINH],
                transactionId: null,
                claimId: CLAIM_DINH.id,
            },
            effects: [],
            store: { ...STORE_REAL_CASE, "bank-transaction": [] },
        },
        {
            name: "a claim that names no amount is matched by the name on the transfer",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: null, claimId: CLAIM_DINH.id },
            output: {
                arrival: ARRIVAL_DINH,
                evidenced: [...EVIDENCED_FOR_DINH],
                claims: [{ ...CLAIM_OF_DINH, amount: null }],
                transactionId: TRANSACTION_DINH.id,
                claimId: CLAIM_DINH.id,
            },
            effects: [],
            store: { ...STORE_REAL_CASE, "payment-claim": [{ ...CLAIM_DINH, amountVnd: null }] },
        },
        {
            name: "a claim not yet tied to a customer takes the customer of its conversation",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: null, claimId: CLAIM_DINH.id },
            output: {
                arrival: ARRIVAL_DINH,
                evidenced: [...EVIDENCED_FOR_DINH],
                claims: [CLAIM_OF_DINH],
                transactionId: TRANSACTION_DINH.id,
                claimId: CLAIM_DINH.id,
            },
            effects: [],
            store: { ...STORE_REAL_CASE, "payment-claim": [{ ...CLAIM_DINH, leadId: null }] },
        },
        {
            name: "a transaction with no open claim at all has no claim to answer",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: TRANSACTION_DINH.id, claimId: null },
            output: {
                arrival: ARRIVAL_DINH,
                evidenced: EVIDENCED_FOR_DINH.map((one) => ({
                    ...one,
                    evidence: one.evidence.map((item) =>
                        item.key === "claim" ? { ...item, met: false, detail: "no open claim of the party" } : item,
                    ),
                    score: one.score - 30,
                })),
                claims: [],
                transactionId: TRANSACTION_DINH.id,
                claimId: null,
            },
            effects: [],
            store: { ...STORE_REAL_CASE, "payment-claim": [] },
        },
        {
            name: "a claim of an unknown customer in an unknown conversation finds its transaction but has no order to offer",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: null, claimId: CLAIM_DINH.id },
            output: {
                arrival: ARRIVAL_DINH,
                evidenced: [],
                claims: [{ ...CLAIM_OF_DINH, partyKey: "conversation:conversation-gone" }, CLAIM_OF_MOMO],
                transactionId: TRANSACTION_DINH.id,
                claimId: CLAIM_DINH.id,
            },
            effects: [],
            store: {
                ...STORE_REAL_CASE,
                "payment-claim": [CLAIM_MOMO, { ...CLAIM_DINH, leadId: null, conversationId: "conversation-gone" }],
            },
        },
        {
            name: "a claim already settled has no evidence",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: null, claimId: CLAIM_DINH.id },
            output: NONE,
            effects: [],
            store: { ...STORE_REAL_CASE, "payment-claim": [{ ...CLAIM_DINH, status: "settled" }] },
        },
        {
            name: "a named 7,000 payer and a second order of a customer nobody knows: the amount of the second order holds",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: TRANSACTION_NAMED.id, claimId: null },
            output: {
                arrival: ARRIVAL_NAMED,
                evidenced: [...EVIDENCED_FOR_NAMED],
                claims: [CLAIM_OF_DINH],
                transactionId: TRANSACTION_NAMED.id,
                claimId: CLAIM_DINH.id,
            },
            effects: [],
            store: STORE_EXTENDED,
        },
        {
            name: "a transaction that is not found has no evidence",
            params: { windowHours: WINDOW_HOURS },
            input: { transactionId: "missing", claimId: null },
            output: NONE,
            effects: [],
            store: STORE_REAL_CASE,
        },
    ],
})
