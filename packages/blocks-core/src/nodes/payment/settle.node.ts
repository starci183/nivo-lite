import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import { paymentMarkPaidEffect } from "../../vocabulary"
import { TOOL } from "../../vocabulary/tool-ids"
import type { NodeSchema } from "../node-schema.types"
import { STORE_REAL_CASE } from "./payment.fixtures"
import { READ_ORDERS } from "./payment.rights"
import type { OrderRow } from "./payment.schemas"

/** The match to settle: the order, the bank transaction that pays it, and how the two amounts compare, as the match read them. */
export interface SettleInput {
    readonly orderId: string
    readonly transactionId: string
    /** How the transfer compares with the order: exact, short or over; null when the match did not say. */
    readonly verdict: "exact" | "short" | "over" | null
    /** What the order is due, VND, read from the order by the match; null when unknown. */
    readonly expectedVnd: number | null
    /** What arrived, VND, read from the transaction by the match; null when unknown. */
    readonly receivedVnd: number | null
}

/** The input as a graph may bind it: the comparison may be left out. */
type SettleGiven = Pick<SettleInput, "orderId" | "transactionId"> & {
    readonly [Key in "verdict" | "expectedVnd" | "receivedVnd"]?: SettleInput[Key] | undefined
}

/** What the agent answers after the guard took the call: the order was paid now, or this transaction had paid it before. */
interface SettleAnswer {
    readonly result: "paid" | "already-paid"
}

/** The settled order, with its customer read from the order (the after-sale hand-off reaches that customer). */
export interface SettleOutput extends SettleAnswer {
    readonly orderId: string
    readonly leadId: string | null
}

const id = z.string().min(1).max(MAX_ID)

const input: NodeSchema<SettleInput, SettleGiven> = z.object({
    orderId: id,
    transactionId: id,
    verdict: z.enum(["exact", "short", "over"]).nullable().default(null),
    expectedVnd: z.number().nullable().default(null),
    receivedVnd: z.number().nullable().default(null),
})

const resultShape = z
    .enum(["paid", "already-paid"])
    .describe("paid: the settle tool marked the order paid now. already-paid: the tool answered already_paid (this transaction had paid it before).")

const answer: NodeSchema<SettleAnswer> = z.object({ result: resultShape })

const output: NodeSchema<SettleOutput> = z.object({
    result: resultShape,
    orderId: id.describe("The order that is paid."),
    leadId: id.nullable().describe("The customer of the order, read from the order."),
})

const MAX_TURNS = 3

/** The grant of the examples: the node's read and what marking an order paid writes. */
const GRANT: RightsGrant = { rights: [READ_ORDERS, ...paymentMarkPaidEffect.rights] }

/**
 * `payment.settle` (Đánh dấu đã trả): the agent marks the order paid with the transaction the match decided to settle, by the two ids,
 * nothing typed beyond them. Whether to settle a short or over transfer was judged by the match (from the policy or the founder's
 * answer); this step only carries it out. A refusal of the tool is a fact: the agent says why (`confused`) and the engine takes over.
 * The customer is told nothing here.
 */
export const paymentSettleNode: NodeDefinition<
    NodeSchema<SettleInput, SettleGiven>,
    NodeSchema<SettleOutput>,
    z.ZodObject<Record<string, never>>
> = defineNode({
    id: "payment.settle",
    role: "output",
    title: bilingualOf("nodePaymentSettleTitle"),
    params: z.object({}),
    input,
    output,
    rights: [READ_ORDERS],
    effects: [TOOL.paymentMarkPaid],
    requires: [TOOL.paymentMarkPaid],
    run: async (given, context) => {
        const decision = await context.agent.run({
            goal: messageOf("en", "nodePaymentSettleGoal"),
            input: given,
            output: answer,
            maxTurns: MAX_TURNS,
        })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        const [order] = await context.data.read<OrderRow>("order", {
            where: { id: given.orderId },
            fields: READ_ORDERS.fields,
            limit: 1,
        })
        return { result: decision.value.result, orderId: given.orderId, leadId: order?.leadId ?? null }
    },
    examples: [
        {
            name: "marks Dinh's order paid with his 5,000 transaction, by the two ids",
            grant: GRANT,
            params: {},
            input: { orderId: "order-dinh", transactionId: "tx-95958515", verdict: "exact", expectedVnd: 5000, receivedVnd: 5000 },
            store: STORE_REAL_CASE,
            model: [
                { call: { tool: TOOL.paymentMarkPaid, args: { orderId: "order-dinh", transactionId: "tx-95958515" } } },
                { done: { result: "paid" } },
            ],
            output: { result: "paid", orderId: "order-dinh", leadId: "lead-dinh" },
            effects: [TOOL.paymentMarkPaid],
        },
    ],
})
