import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { needsOwner } from "./order.policy"
import type { NodeSchema } from "./order.schema"

/** The default threshold: an order of 5,000,000 VND or more waits for the owner. */
export const DEFAULT_THRESHOLD_VND = 5_000_000

/** The setting of the graph: from which amount the owner decides. */
export interface OrderConfirmParams {
    /** An order of this amount or more waits for the owner. */
    readonly thresholdVnd: number
}

/** The order to confirm. */
export interface OrderConfirmInput {
    /** The recorded order. */
    readonly orderId: string
    /** The amount of the order, VND. */
    readonly amountVnd: number
    /** The customer name, for the owner decision; null when unknown. */
    readonly customer: string | null
}

/** Where the order stands; the graph routes on it. */
export interface OrderConfirmOutput {
    /** `confirmed`, or `awaiting-owner` while the owner decides. */
    readonly branch: "confirmed" | "awaiting-owner"
}

const params: z.ZodType<OrderConfirmParams, { thresholdVnd?: number | undefined }> = z.object({
    thresholdVnd: z.number().min(0).default(DEFAULT_THRESHOLD_VND),
})

const input: NodeSchema<OrderConfirmInput> = z.object({
    orderId: z.string().min(1),
    amountVnd: z.number().min(0),
    customer: z.string().max(200).nullable(),
})

const output: NodeSchema<OrderConfirmOutput> = z.object({ branch: z.enum(["confirmed", "awaiting-owner"]) })

/**
 * `order.confirm`: confirms an order below the threshold; an order at the threshold or above raises a work item for the owner to
 * decide instead, and the graph waits on the `awaiting-owner` branch.
 */
export const orderConfirmNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: "order.confirm",
    role: "condition",
    title: { vi: "Xác nhận đơn hàng", en: "Confirm the order" },
    params,
    input,
    output,
    rights: [],
    effects: ["order.confirm", "work-item.raise"],
    run: async (given, context) => {
        const subject = { kind: "order", id: given.orderId }
        if (!needsOwner(given.amountVnd, context.params.thresholdVnd)) {
            await context.effect("order.confirm", subject, { orderId: given.orderId })
            return { branch: "confirmed" }
        }
        await context.effect("work-item.raise", subject, {
            action: "confirm_order",
            title: given.customer ?? given.orderId,
            payload: { orderId: given.orderId },
            amountVnd: given.amountVnd,
        })
        return { branch: "awaiting-owner" }
    },
    examples: [
        {
            name: "confirms an order below the threshold",
            params: {},
            input: { orderId: "o1", amountVnd: 4_999_999, customer: "Lan" },
            output: { branch: "confirmed" },
            effects: [{ kind: "order.confirm", payload: { orderId: "o1" } }],
        },
        {
            name: "raises a work item for the owner at the threshold",
            params: {},
            input: { orderId: "o1", amountVnd: 5_000_000, customer: "Lan" },
            output: { branch: "awaiting-owner" },
            effects: [
                {
                    kind: "work-item.raise",
                    payload: {
                        action: "confirm_order",
                        title: "Lan",
                        payload: { orderId: "o1" },
                        amountVnd: 5_000_000,
                    },
                },
            ],
        },
        {
            name: "follows the threshold the graph sets, and titles an unnamed customer by the order",
            params: { thresholdVnd: 1_000_000 },
            input: { orderId: "o1", amountVnd: 1_000_000, customer: null },
            output: { branch: "awaiting-owner" },
            effects: [
                {
                    kind: "work-item.raise",
                    payload: {
                        action: "confirm_order",
                        title: "o1",
                        payload: { orderId: "o1" },
                        amountVnd: 1_000_000,
                    },
                },
            ],
        },
    ],
})
