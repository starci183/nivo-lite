import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { z } from "zod"
import { mergedItems, recordedItemsOf, resolvedItems, totalOf } from "../order/order.policy"
import type { CatalogueRow } from "../order/order.policy"
import { addressSchema, orderItemsSchema } from "../order/order.schema"
import type { NodeSchema } from "../node-schema.types"
import type { OrderItem } from "../order/order.schema"
import { MAX_ID } from "../../bounds"
import { bilingualOf, sampleOf } from "../../messages/catalog"

/** What the intent of the conversation gave: who orders, the items, the address and a note. */
export interface OrderFromChatInput {
    /** The customer. */
    readonly leadId: string
    /** The lines asked for. */
    readonly items: ReadonlyArray<OrderItem>
    /** Where to deliver, or null. */
    readonly address: string | null
    /** A note of the customer, or null. */
    readonly note: string | null
}

/** The draft that was recorded. */
export interface OrderFromChatOutput {
    /** The id of the recorded order. */
    readonly orderId: string
    /** The lines, equal names merged and the catalogue's names and prices put in. */
    readonly items: ReadonlyArray<OrderItem>
    /** The amount, VND, or null while a line has no price. */
    readonly amountVnd: number | null
}

/** The most catalogue rows one record reads. */
const CATALOGUE_LIMIT = 500

/** The agent grant the examples run under: the node own rights and the rights of the effect it runs. */
const EXAMPLE_GRANT: RightsGrant = {
    rights: [
        { kind: "catalogue-item", access: "read", scope: "workspace", fields: ["id", "name", "priceVnd", "active"] },
        { kind: "order", access: "write", scope: "turn", fields: ["leadId", "items", "amountVnd"] },
    ],
}

const params: z.ZodObject<Record<string, never>> = z.object({})

const input: NodeSchema<OrderFromChatInput> = z.object({
    leadId: z.string().max(MAX_ID).min(1),
    items: orderItemsSchema,
    address: addressSchema,
    note: z.string().max(500).nullable(),
})

const output: NodeSchema<OrderFromChatOutput> = z.object({
    orderId: z.string().max(MAX_ID),
    items: orderItemsSchema,
    amountVnd: z.number().nullable(),
})

/** `sales.order-from-chat`: records the order the conversation asked for (items, quantity, price from the catalogue, address); nothing is confirmed. */
export const salesOrderFromChatNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: "sales.order-from-chat",
    role: "output",
    title: bilingualOf("nodeSalesOrderFromChatTitle"),
    params,
    input,
    output,
    rights: [
        { kind: "catalogue-item", access: "read", scope: "workspace", fields: ["id", "name", "priceVnd", "active"] },
    ],
    effects: ["order.record"],
    run: async (given, context) => {
        const catalogue = await context.data.read<CatalogueRow>("catalogue-item", {
            fields: ["id", "name", "priceVnd", "active"],
            limit: CATALOGUE_LIMIT,
        })
        const items = resolvedItems(mergedItems(given.items), catalogue)
        const amountVnd = totalOf(items)
        const note = [given.note, given.address].filter((part) => part !== null && part !== "").join(" · ")
        const ref = await context.effect("order.record", {
            leadId: given.leadId,
            items: recordedItemsOf(items),
            amountVnd,
            ...(note === "" ? {} : { note }),
        })
        return { orderId: ref.id, items, amountVnd }
    },
    examples: [
        {
            name: "merges a repeated line, prices it from the catalogue and carries the address in the note",
            params: {},
            input: {
                leadId: "lead-1",
                items: [
                    { name: sampleOf("sampleTraSen"), quantity: 1, priceVnd: null },
                    { name: sampleOf("sampleTraSen4"), quantity: 2, priceVnd: null },
                ],
                address: sampleOf("sample12LeLoiHue"),
                note: sampleOf("sampleGoiTruoc"),
            },
            output: {
                orderId: "order.record-1",
                items: [{ name: sampleOf("sampleTraSen"), quantity: 3, priceVnd: 120_000, catalogueItemId: "c1" }],
                amountVnd: 360_000,
            },
            grant: EXAMPLE_GRANT,
            effects: [
                {
                    kind: "order.record",
                    payload: {
                        leadId: "lead-1",
                        items: [
                            { name: sampleOf("sampleTraSen"), qty: 3, unitPriceVnd: 120_000, catalogueItemId: "c1" },
                        ],
                        amountVnd: 360_000,
                        note: sampleOf("sampleGoiTruoc12LeLoiHue"),
                    },
                },
            ],
            store: {
                "catalogue-item": [{ id: "c1", name: sampleOf("sampleTraSen"), priceVnd: 120_000, active: true }],
            },
        },
        {
            name: "records an item the catalogue lacks, unpriced, without a total or a note",
            params: {},
            input: {
                leadId: "lead-1",
                items: [{ name: sampleOf("sampleBanh"), quantity: 2, priceVnd: null }],
                address: null,
                note: null,
            },
            output: {
                orderId: "order.record-1",
                items: [{ name: sampleOf("sampleBanh"), quantity: 2, priceVnd: null }],
                amountVnd: null,
            },
            grant: EXAMPLE_GRANT,
            effects: [
                {
                    kind: "order.record",
                    payload: { leadId: "lead-1", items: [{ name: sampleOf("sampleBanh"), qty: 2 }], amountVnd: null },
                },
            ],
        },
    ],
})
