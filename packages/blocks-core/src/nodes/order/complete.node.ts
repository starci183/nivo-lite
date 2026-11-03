import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { gapsOf, mergedItems, totalOf } from "./order.policy"
import type { CatalogueRow } from "./order.policy"
import { addressSchema, orderGapSchema, orderItemsSchema } from "./order.schema"
import type { NodeSchema, OrderGap, OrderItem } from "./order.schema"

/** The order to check. */
export interface OrderCompleteInput {
    /** The lines asked for. */
    readonly items: ReadonlyArray<OrderItem>
    /** Where to deliver, or null. */
    readonly address: string | null
}

/** The verdict the graph routes on. */
export interface OrderCompleteOutput {
    /** `complete` when every item is in the catalogue with a price and the order has an address; `missing` otherwise. */
    readonly branch: "complete" | "missing"
    /** What to ask the customer; empty when complete. */
    readonly missing: ReadonlyArray<OrderGap>
    /** The items the catalogue prices, with the catalogue's names and prices. */
    readonly items: ReadonlyArray<OrderItem>
    /** The amount of a complete order, or null. */
    readonly amountVnd: number | null
}

/** The most catalogue rows one check reads. */
const CATALOGUE_LIMIT = 500

const params: z.ZodObject<Record<string, never>> = z.object({})

const input: NodeSchema<OrderCompleteInput> = z.object({ items: orderItemsSchema, address: addressSchema })

const output: NodeSchema<OrderCompleteOutput> = z.object({
    branch: z.enum(["complete", "missing"]),
    missing: z.array(orderGapSchema),
    items: orderItemsSchema,
    amountVnd: z.number().nullable(),
})

/** `order.complete`: the condition "is the order complete?": every item in the active catalogue with a price, and an address. */
export const orderCompleteNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: "order.complete",
    role: "condition",
    title: { vi: "Đơn đã đủ thông tin?", en: "Is the order complete?" },
    params,
    input,
    output,
    rights: [{ kind: "catalogue-item", access: "read", scope: "workspace", fields: ["id", "name", "priceVnd", "active"] }],
    effects: [],
    run: async (given, context) => {
        const catalogue = await context.data.read<CatalogueRow>("catalogue-item", {
            fields: ["id", "name", "priceVnd", "active"],
            limit: CATALOGUE_LIMIT,
        })
        const { items, gaps } = gapsOf(mergedItems(given.items), given.address, catalogue)
        const complete = gaps.length === 0
        return {
            branch: complete ? "complete" : "missing",
            missing: gaps,
            items,
            amountVnd: complete ? totalOf(items) : null,
        }
    },
    examples: [
        {
            name: "is complete when the catalogue prices every item and there is an address",
            params: {},
            input: { items: [{ name: "tra sen", quantity: 2, priceVnd: null }], address: "12 Lê Lợi, Huế" },
            output: {
                branch: "complete",
                missing: [],
                items: [{ name: "Trà sen", quantity: 2, priceVnd: 120_000, catalogueItemId: "c1" }],
                amountVnd: 240_000,
            },
            effects: [],
            store: { "catalogue-item": [{ id: "c1", name: "Trà sen", priceVnd: 120_000, active: true }] },
        },
        {
            name: "lists every gap: an item the shop lacks, an unpriced one, a retired one and the address",
            params: {},
            input: {
                items: [
                    { name: "Rượu", quantity: 1, priceVnd: 50_000 },
                    { name: "Bánh", quantity: 1, priceVnd: null },
                    { name: "Chè", quantity: 1, priceVnd: null },
                ],
                address: " ",
            },
            output: {
                branch: "missing",
                missing: [
                    { reason: "not_in_catalogue", item: "Rượu" },
                    { reason: "no_price", item: "Bánh" },
                    { reason: "not_in_catalogue", item: "Chè" },
                    { reason: "no_address", item: null },
                ],
                items: [],
                amountVnd: null,
            },
            effects: [],
            store: {
                "catalogue-item": [
                    { id: "c2", name: "Bánh", priceVnd: null, active: true },
                    { id: "c3", name: "Chè", priceVnd: 20_000, active: false },
                ],
            },
        },
        {
            name: "asks for the items when there are none",
            params: {},
            input: { items: [], address: "12 Lê Lợi, Huế" },
            output: { branch: "missing", missing: [{ reason: "no_items", item: null }], items: [], amountVnd: null },
            effects: [],
        },
    ],
})
