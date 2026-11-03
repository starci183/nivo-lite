import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"

/** One line of an order as the intent or the catalogue gives it. */
export interface OrderItem {
    /** What was asked for, as the customer said it. */
    readonly name: string
    /** How many; at least one. */
    readonly quantity: number
    /** The price of one, VND, or null while unknown. */
    readonly priceVnd: number | null
    /** The catalogue item it was matched to, once matched. */
    readonly catalogueItemId?: string | undefined
}

/** Why an order is not complete. */
export type MissingReason = "no_items" | "not_in_catalogue" | "no_price" | "no_address"

/** One gap of an order: the reason, and the item it is about when it is about one. */
export interface OrderGap {
    /** The reason. */
    readonly reason: MissingReason
    /** The item, or null for a gap of the whole order. */
    readonly item: string | null
}

/** One line of an order. */
export const orderItemSchema: NodeSchema<OrderItem> = z.object({
    name: z.string().min(1).max(200),
    quantity: z.number().int().min(1).max(10_000),
    priceVnd: z.number().min(0).nullable(),
    catalogueItemId: z.string().optional(),
})

/** The items of an order: at most a hundred lines. */
export const orderItemsSchema: NodeSchema<ReadonlyArray<OrderItem>> = z.array(orderItemSchema).max(100)

/** A delivery address, or null while the customer has not given one. */
export const addressSchema: NodeSchema<string | null> = z.string().max(500).nullable()

/** One gap of an incomplete order. */
export const orderGapSchema: NodeSchema<OrderGap> = z.object({
    reason: z.enum(["no_items", "not_in_catalogue", "no_price", "no_address"]),
    item: z.string().nullable(),
})
