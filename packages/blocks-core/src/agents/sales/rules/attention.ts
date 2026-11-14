import { moneyLine } from "./money"
import type { WaitingOrder } from "./waiting"

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

/** The reason of an order over the limit that waits for the owner. */
export const WAITS_FOR_OWNER = "owner"

/** The reason of a deal whose next step is past its day. */
export const OVERDUE = "overdue"

/** The reason of a customer the assistant has a question about. */
export const NEEDS_REPLY = "needs_reply"

/** The part of a customer the awaiting list shows. */
export interface AwaitingLead {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contactName: string
    /** What the customer needs. */
    readonly need: string | null
    /** Since when the customer waits, ISO text. */
    readonly awaitingSince: string | null
}

/** The customers who wait for an answer as attention rows. */
export const awaitingRowsOf = (leads: ReadonlyArray<AwaitingLead>): ReadonlyArray<AttentionItem> =>
    leads.map((lead) => ({
        id: lead.id,
        title: lead.contactName,
        description: lead.need ?? "",
        reason: AWAITING_REPLY,
        at: lead.awaitingSince ?? "",
    }))

/** The part of a deal the overdue list shows. */
export interface DueLead {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contactName: string
    /** The next step of the deal, or null. */
    readonly nextStep: string | null
    /** When the next step was due, ISO text. */
    readonly nextDueAt: string | null
}

/** The part of a customer the question list shows. */
export interface AskingLead {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contactName: string
    /** What the assistant still needs from the owner, or null. */
    readonly needs: string | null
    /** When the customer last changed, ISO text. */
    readonly updatedAt: string
}

/** The deals whose next step is past its day as attention rows. */
export const overdueRowsOf = (leads: ReadonlyArray<DueLead>): ReadonlyArray<AttentionItem> =>
    leads.map((lead) => ({
        id: lead.id,
        title: lead.contactName,
        description: lead.nextStep ?? "",
        reason: OVERDUE,
        at: lead.nextDueAt ?? "",
    }))

/** The customers the assistant has a question about as attention rows. */
export const needsRowsOf = (leads: ReadonlyArray<AskingLead>): ReadonlyArray<AttentionItem> =>
    leads.map((lead) => ({
        id: lead.id,
        title: lead.contactName,
        description: lead.needs ?? "",
        reason: NEEDS_REPLY,
        at: lead.updatedAt,
    }))

/** The orders that wait for the owner as attention rows: the order number and the customer, what was ordered and its amount. */
export const ownerRowsOf = (orders: ReadonlyArray<WaitingOrder>): ReadonlyArray<AttentionItem> =>
    orders.map((order) => ({
        id: order.id,
        title: order.customer === null ? order.orderNo : `${order.orderNo} \u00b7 ${order.customer}`,
        description: [order.items, moneyLine(order.amountVnd)].filter((part) => part !== "").join(" \u00b7 "),
        reason: WAITS_FOR_OWNER,
        at: "",
    }))
