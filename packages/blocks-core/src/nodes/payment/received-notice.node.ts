import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import { TOOL } from "../../vocabulary/tool-ids"
import type { NodeSchema } from "../node-schema.types"

/** The order whose money arrived. */
export interface ReceivedNoticeInput {
    readonly orderId: string
}

/** Whether the team was told. */
export interface ReceivedNoticeOutput {
    /** True once the card was posted. */
    readonly posted: boolean
}

const id = z.string().min(1).max(MAX_ID)

const input: NodeSchema<ReceivedNoticeInput> = z.object({ orderId: id })

const output: NodeSchema<ReceivedNoticeOutput> = z.object({
    posted: z.boolean().describe("True once the payment-received card was posted to the team."),
})

const MAX_TURNS = 3

/**
 * `payment.received-notice` (Báo đội): the agent posts the payment-received card to the team on /chat (`TOOL.teamMessagePost` of kind
 * `payment.received`, by the order id: the card is drawn server-side from the records, the agent types no amount). The
 * customer is thanked once, by the Cảm ơn sau mua workflow the graph calls next, never here. A side node (`blocking: false`): a post that
 * fails after its tries is recorded and the run goes on.
 */
export const paymentReceivedNoticeNode: NodeDefinition<
    NodeSchema<ReceivedNoticeInput>,
    NodeSchema<ReceivedNoticeOutput>,
    z.ZodObject<Record<string, never>>
> = defineNode({
    id: "payment.received-notice",
    role: "output",
    title: bilingualOf("nodePaymentReceivedNoticeTitle"),
    params: z.object({}),
    input,
    output,
    rights: [],
    effects: [TOOL.teamMessagePost],
    requires: [TOOL.teamMessagePost],
    blocking: false,
    run: async (given, context) => {
        const decision = await context.agent.run({
            goal: messageOf("en", "nodePaymentReceivedNoticeGoal"),
            input: given,
            output,
            maxTurns: MAX_TURNS,
        })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        return decision.value
    },
    examples: [
        {
            name: "posts the payment-received card of Dinh's order to the team, by its id",
            params: {},
            input: { orderId: "order-dinh" },
            model: [
                { call: { tool: TOOL.teamMessagePost, args: { kind: "payment.received", orderId: "order-dinh" } } },
                { done: { posted: true } },
            ],
            output: { posted: true },
            effects: [TOOL.teamMessagePost],
        },
    ],
})
