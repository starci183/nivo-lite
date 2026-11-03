import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import type { NodeSchema } from "../order/order.schema"

/** What the graph sets: the action the owner decides and the title they see. */
export interface RaiseWorkItemParams {
    /** The action the work item asks the owner to decide (`confirm_order`). */
    readonly action: string
    /** The title of the work item. */
    readonly title: string
}

/** What the work item carries. */
export interface RaiseWorkItemInput {
    /** The data the decision acts on (ids, never prose). */
    readonly payload: Readonly<Record<string, string | number | boolean | null>>
    /** The amount at stake, VND, or null. */
    readonly amountVnd: number | null
}

/** The raised item. */
export interface RaiseWorkItemOutput {
    /** The work item the owner will see. */
    readonly workItemId: string
}

const params: NodeSchema<RaiseWorkItemParams> = z.object({
    action: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/),
    title: z.string().min(1).max(200),
})

const input: NodeSchema<RaiseWorkItemInput> = z.object({
    payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    amountVnd: z.number().min(0).nullable(),
})

const output: NodeSchema<RaiseWorkItemOutput> = z.object({ workItemId: z.string() })

/** `core.raise-work-item`: raises a work item for the owner to decide, with the action and the title the graph spec sets. */
export const raiseWorkItemNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: "core.raise-work-item",
    role: "output",
    title: { vi: "Giao việc cho chủ", en: "Raise a work item for the owner" },
    params,
    input,
    output,
    rights: [],
    effects: ["work-item.raise"],
    run: async (given, context) => {
        const ref = await context.effect("work-item.raise", {
            action: context.params.action,
            title: context.params.title,
            payload: given.payload,
            ...(given.amountVnd === null ? {} : { amountVnd: given.amountVnd }),
        })
        return { workItemId: ref.id }
    },
    examples: [
        {
            name: "raises the order for the owner with its amount",
            params: { action: "confirm_order", title: "Order waits for the owner" },
            input: { payload: { orderId: "o1" }, amountVnd: 5_000_000 },
            output: { workItemId: "work-item.raise-1" },
            effects: [
                {
                    kind: "work-item.raise",
                    payload: {
                        action: "confirm_order",
                        title: "Order waits for the owner",
                        payload: { orderId: "o1" },
                        amountVnd: 5_000_000,
                    },
                },
            ],
        },
        {
            name: "raises an item that has no amount",
            params: { action: "connect_sepay", title: "Connect SePay" },
            input: { payload: {}, amountVnd: null },
            output: { workItemId: "work-item.raise-1" },
            effects: [{ kind: "work-item.raise", payload: { action: "connect_sepay", title: "Connect SePay", payload: {} } }],
        },
    ],
})
