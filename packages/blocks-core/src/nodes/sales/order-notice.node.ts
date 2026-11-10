import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import { TOOL } from "../../vocabulary/tool-ids"
import { exampleGrantOf } from "./consult.grant"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { nodeGoalOf } from "../node-ui"

/** The order that was just created, and who it is for. */
export interface OrderNoticeInput {
    /** The order. */
    readonly orderId: string
    /** The customer, or null when the run has none. */
    readonly leadId: string | null
    /** The language the team reads. */
    readonly locale: NodeLocale
}

/** Whether the team was told. */
export interface OrderNoticeOutput {
    /** True when the order card was posted to the team. */
    readonly posted: boolean
}

/** The id of the step, which names its goal in the messages catalog. */
const ID = "sales.order-notice"

/** The kind of the team card that shows an order, built server-side from the order record. */
const ORDER_CARD = "order.summary"

const params: z.ZodObject<Record<string, never>> = z.object({})

const input: NodeSchema<OrderNoticeInput> = z.object({
    orderId: z.string().min(1).max(MAX_ID),
    leadId: z.string().min(1).max(MAX_ID).nullable(),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<OrderNoticeOutput> = z.object({
    posted: z.boolean().describe(`True when ${TOOL.teamMessagePost} posted the order card`),
})

/** How the agent of the step behaves. */
const GUIDANCE =
    `Call ${TOOL.teamMessagePost} with \`kind\` "${ORDER_CARD}" and \`orderId\` only: the card (number, lines, total, customer, ` +
    "delivery) is built from the order record. You type no line, price or total."

/** The effects the agent of the step may call: its whole reach. */
const EFFECTS = [TOOL.teamMessagePost]

const GRANT = exampleGrantOf([], EFFECTS)

/**
 * `sales.order-notice` (Báo đội đơn mới): an Agent + MCP step that posts the new order's card to the team on /chat, by the order id
 * alone; the card is rendered server-side from the order. A side step (`blocking: false`): when it cannot complete, the team is told and
 * the customer's path goes on.
 */
export const salesOrderNoticeNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: ID,
    role: "output",
    title: bilingualOf("nodeSalesOrderNoticeTitle"),
    params,
    input,
    output,
    rights: [],
    effects: EFFECTS,
    requires: [TOOL.teamMessagePost],
    blocking: false,
    run: async (given, context) => {
        const decision = await context.agent.run({
            goal: `${nodeGoalOf(ID, "en")}\n${GUIDANCE}`,
            purpose: "order-notice",
            input: given,
            output,
            maxTurns: 3,
        })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        return decision.value
    },
    examples: [
        {
            name: "posts the order card to the team by the order id alone",
            params: {},
            grant: GRANT,
            input: { orderId: "order-1", leadId: "lead-1", locale: "vi" },
            output: { posted: true },
            effects: [{ kind: TOOL.teamMessagePost, payload: { kind: ORDER_CARD, orderId: "order-1" } }],
            model: [
                { call: { tool: TOOL.teamMessagePost, args: { kind: ORDER_CARD, orderId: "order-1" } } },
                { done: { posted: true } },
            ],
        },
    ],
})
