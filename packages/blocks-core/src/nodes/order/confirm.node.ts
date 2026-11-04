import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"
import { MAX_ID } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"

/** The order to confirm. */
export interface OrderConfirmInput {
    /** The recorded order. */
    readonly orderId: string
}

/** What was confirmed. */
export interface OrderConfirmOutput {
    /** The confirmed order. */
    readonly orderId: string
}

/** The agent grant the example runs under: the rights of the effect the node runs. */
const EXAMPLE_GRANT: RightsGrant = { rights: [{ kind: "order", access: "write", scope: "turn", fields: ["status"] }] }

const params: z.ZodObject<Record<string, never>> = z.object({})

const input: NodeSchema<OrderConfirmInput> = z.object({ orderId: z.string().max(MAX_ID).min(1) })

const output: NodeSchema<OrderConfirmOutput> = z.object({ orderId: z.string().max(MAX_ID) })

/** `order.confirm`: confirms the recorded order, once per order across runs (dedupe key `order-confirm:<orderId>`). */
export const orderConfirmNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: "order.confirm",
    role: "output",
    title: bilingualOf("nodeOrderConfirmTitle"),
    params,
    input,
    output,
    rights: [],
    effects: ["order.confirm"],
    run: async (given, context) => {
        await context.effect(
            "order.confirm",
            { orderId: given.orderId },
            { dedupeKey: `order-confirm:${given.orderId}` },
        )
        return { orderId: given.orderId }
    },
    examples: [
        {
            name: "confirms the order",
            params: {},
            input: { orderId: "o1" },
            output: { orderId: "o1" },
            grant: EXAMPLE_GRANT,
            effects: [{ kind: "order.confirm", payload: { orderId: "o1" } }],
        },
    ],
})
