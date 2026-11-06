import { moneyLine } from "./money"

/** One row of the attention lists: a customer or an order that needs the person, and since when. */
export interface AttentionItem {
    /** The id of the customer or order. */
    readonly id: string
    /** Who or what it is. */
    readonly title: string
    /** What it is about. */
    readonly description: string
    /** Why it needs attention, as a stable code the module block gives words to. */
    readonly reason: string
    /** Since when, ISO text; empty when unknown. */
    readonly at: string
}

/** The reason of a customer who waits for an answer. */
export const AWAITING_REPLY = "awaiting_reply"

/** The reason of an order whose follow-up step failed. */
export const FAILED_STEP = "failed_step"

/** The part of a customer the awaiting list shows. */
export interface AwaitingLead {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contactName: string
    /** What the customer needs. */
    readonly need: string
    /** Since when the customer waits, ISO text. */
    readonly awaitingSince: string | null
}

/** The part of an order the failed-steps list shows. */
export interface FailedOrder {
    /** The order id. */
    readonly id: string
    /** The order number. */
    readonly orderNo: string
    /** What was ordered. */
    readonly items: string
    /** The amount, VND, or null. */
    readonly amountVnd: number | null
    /** When the order was made, ISO text. */
    readonly createdAt: string
}

/** The customers who wait for an answer as attention rows. */
export const awaitingRowsOf = (leads: ReadonlyArray<AwaitingLead>): ReadonlyArray<AttentionItem> =>
    leads.map((lead) => ({
        id: lead.id,
        title: lead.contactName,
        description: lead.need,
        reason: AWAITING_REPLY,
        at: lead.awaitingSince ?? "",
    }))

/** The orders with a failed step as attention rows; `names` holds the customer name by order id. */
export const failedRowsOf = (
    orders: ReadonlyArray<FailedOrder>,
    names: Readonly<Record<string, string>>,
): ReadonlyArray<AttentionItem> =>
    orders.map((order) => ({
        id: order.id,
        title: order.id in names ? `${order.orderNo} \u00b7 ${names[order.id]}` : order.orderNo,
        description: [order.items, moneyLine(order.amountVnd)].filter((part) => part !== "").join(" \u00b7 "),
        reason: FAILED_STEP,
        at: order.createdAt,
    }))
