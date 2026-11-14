import { CONFIRMED_STATUSES, LIVE_STATUSES, type OrderStatus } from "./order-status"

/** An order reduced to what a customer's detail names. */
export interface OrderBrief {
    /** The order number. */
    readonly orderNo: string
    /** Where the order stands. */
    readonly status: OrderStatus
    /** The amount, VND, or null while unknown. */
    readonly amountVnd: number | null
    /** When the order was created, ISO text. */
    readonly createdAt: string
}

/** What a customer's orders add up to. */
export interface OrderSummary {
    /** How many orders count as the customer's: cancelled and failed ones do not. */
    readonly count: number
    /** The sum of the confirmed orders, VND. */
    readonly confirmedVnd: number
    /** The newest order that counts, or null when there is none. */
    readonly latest: OrderBrief | null
}

/** The orders of one customer added up: how many count, what is confirmed and the newest. */
export const orderSummaryOf = (orders: ReadonlyArray<OrderBrief>): OrderSummary => {
    const live = orders.filter((order) => LIVE_STATUSES.includes(order.status))
    const latest = live.reduce<OrderBrief | null>(
        (newest, order) => (newest === null || order.createdAt > newest.createdAt ? order : newest),
        null,
    )
    const confirmedVnd = live
        .filter((order) => CONFIRMED_STATUSES.includes(order.status))
        .reduce((sum, order) => sum + (order.amountVnd ?? 0), 0)
    return { count: live.length, confirmedVnd, latest }
}
