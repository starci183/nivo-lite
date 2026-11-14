import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../bounds"

/** How close an order's amount is to the payment: the same, within a tenth of it, or not near. */
export type OrderMatch = "exact" | "near" | "other"

/** The share of the payment an order's amount may differ by and still be near it. */
export const NEAR_SHARE = 0.1

/** One order that waits for money, as the picker lists it. */
export interface OpenOrderRow {
    /** The order id, which the picker sends. */
    readonly id: string
    /** The number the customer is told, with the customer's name when there is one. */
    readonly title: string
    /** The amount due in VND; null when the order is not priced yet. */
    readonly amountVnd: number | null
    /** The amount as words. */
    readonly amount: string
}

/** The orders the picker lists. */
export interface OpenOrdersView {
    /** The orders that wait for money. */
    readonly rows: ReadonlyArray<OpenOrderRow>
}

const VND = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 })

/** The orders that wait for money as the view the picker reads. */
export const openOrdersOf = (
    orders: ReadonlyArray<{
        readonly id: string
        readonly orderNo: string
        readonly amountVnd: number | null
        readonly customer: string | null
    }>,
): OpenOrdersView => ({
    rows: orders.map((order) => ({
        id: order.id,
        title: order.customer === null ? order.orderNo : `${order.orderNo} \u00b7 ${order.customer}`,
        amountVnd: order.amountVnd,
        amount: order.amountVnd === null ? "" : VND.format(Math.round(order.amountVnd)),
    })),
})

/** The shape of the orders the picker reads. */
export const openOrdersView: z.ZodType<OpenOrdersView> = z.object({
    rows: z
        .array(
            z.object({
                id: z.string().min(1).max(MAX_ID),
                title: z.string().max(MAX_LINE),
                amountVnd: z.number().nullable(),
                amount: z.string().max(MAX_LINE),
            }),
        )
        .max(200),
})

/** How close an order is to a payment of `paymentVnd`. An order not priced yet is not near. */
export const matchOf = (order: OpenOrderRow, paymentVnd: number): OrderMatch => {
    if (order.amountVnd === null) return "other"
    if (order.amountVnd === paymentVnd) return "exact"
    return Math.abs(order.amountVnd - paymentVnd) <= paymentVnd * NEAR_SHARE ? "near" : "other"
}

const ORDER_OF_MATCH: Readonly<Record<OrderMatch, number>> = { exact: 0, near: 1, other: 2 }

/** An order of the picker with how close it is to the payment. */
export interface RankedOrder extends OpenOrderRow {
    /** How close the amount is to the payment. */
    readonly match: OrderMatch
}

/** The orders that contain the query in their title (case and accents aside), the same amount first, then the near ones, then the rest. */
export const rankedOrders = (
    orders: ReadonlyArray<OpenOrderRow>,
    paymentVnd: number,
    query: string,
): ReadonlyArray<RankedOrder> => {
    const needle = query.trim().toLowerCase()
    return orders
        .filter((order) => needle === "" || order.title.toLowerCase().includes(needle))
        .map((order): RankedOrder => ({ ...order, match: matchOf(order, paymentVnd) }))
        .sort((left, right) => ORDER_OF_MATCH[left.match] - ORDER_OF_MATCH[right.match])
}
