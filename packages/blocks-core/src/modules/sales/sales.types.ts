import type { OrderItems } from "../../entities/sales/order.entity"
import type { LeadStage, OrderStatus } from "../../rules/sales"

/** A customer deal as the lead entity holds it. */
export interface LeadRow {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contactName: string
    /** The company, or null when unknown. */
    readonly company: string | null
    /** The channel the customer came through. */
    readonly channel: string
    /** What the customer needs, or null. */
    readonly need: string | null
    /** Where the deal stands. */
    readonly stage: LeadStage
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The normalised email, or null. */
    readonly email: string | null
    /** The context brief, or null. */
    readonly contextSummary: string | null
    /** Why the deal was closed (won or lost); null while it is open. */
    readonly closedReason: string | null
    /** Since when the customer waits for an answer, ISO text; null when nobody waits. */
    readonly awaitingSince: string | null
    /** Who looks after the deal, or null. */
    readonly owner: string | null
    /** The next step of the deal, or null. */
    readonly nextStep: string | null
    /** When the next step is due, ISO text, or null. */
    readonly nextDueAt: string | null
    /** The amount of the quote, VND, or null. */
    readonly quoteVnd: number | null
    /** The amount of the order, VND, or null. */
    readonly orderVnd: number | null
    /** A line about where the deal stands, or null. */
    readonly note: string | null
    /** What the assistant still needs from the owner, or null. */
    readonly needs: string | null
    /** The version token an update must present. */
    readonly version: string
    /** When the lead was created, ISO text. */
    readonly createdAt: string
    /** When the lead last changed, ISO text. */
    readonly updatedAt: string
}

/** An order as the order entity holds it. */
export interface OrderRow {
    /** The order id. */
    readonly id: string
    /** The order number, unique per workspace. */
    readonly orderNo: string
    /** The customer, or null. */
    readonly leadId: string | null
    /** The lines of the order. */
    readonly items: OrderItems
    /** What was ordered, as `2 x tea, 1 x cake`: the text the lists show and search, a projection of the lines. */
    readonly itemsText: string
    /** The delivery address and notes; empty when there are none. */
    readonly note: string
    /** The amount, VND, or null while a line has no price. */
    readonly amountVnd: number | null
    /** Where the order stands. */
    readonly status: OrderStatus
    /** Who confirmed it. */
    readonly confirmedBy: string | null
    /** When it was confirmed, ISO text. */
    readonly confirmedAt: string | null
    /** When the carrier received it, ISO text. */
    readonly shippedAt: string | null
    /** The carrier handling the shipment. */
    readonly carrier: string | null
    /** The carrier's tracking reference. */
    readonly trackingCode: string | null
    /** The version token an update must present. */
    readonly version: string
    /** When the order was created, ISO text. */
    readonly createdAt: string
    /** When the order last changed, ISO text. */
    readonly updatedAt: string
}

/** The detail of a lead, flat so a detail block can name each fact by a path. */
export interface LeadDetail {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contactName: string
    /** The company, empty when unknown. */
    readonly company: string
    /** The channel the customer came through. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** Where the deal stands. */
    readonly stage: LeadStage
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The normalised email, or null. */
    readonly email: string | null
    /** The context brief, or null. */
    readonly contextSummary: string | null
    /** Why the deal was closed; null while it is open. */
    readonly closedReason: string | null
    /** When the lead was created, ISO text. */
    readonly createdAt: string
    /** When the lead last changed, ISO text. */
    readonly updatedAt: string
    /** How many orders count as the customer's. */
    readonly orderCount: number
    /** The sum of the confirmed orders, VND. */
    readonly confirmedVnd: number
    /** The number of the newest order, or null. */
    readonly latestOrderNo: string | null
    /** The status of the newest order, or null. */
    readonly latestOrderStatus: OrderStatus | null
    /** The amount of the newest order, VND, or null. */
    readonly latestOrderAmountVnd: number | null
}

/** Who may confirm an order: the shop (below the owner threshold), or only the owner. */
export type OrderApproval = "shop" | "owner" | "done"

/** The detail of an order, flat so a detail block can name each fact by a path. */
export interface OrderDetail {
    /** The order id. */
    readonly id: string
    /** The order number. */
    readonly orderNo: string
    /** The customer's id, or null. */
    readonly leadId: string | null
    /** The customer's name, or null. */
    readonly customer: string | null
    /** What was ordered, as text. */
    readonly items: string
    /** The delivery address and notes. */
    readonly note: string
    /** The amount, VND, or null while unknown. */
    readonly amountVnd: number | null
    /** Where the order stands. */
    readonly status: OrderStatus
    /** `owner` while the order waits for the owner, `shop` when the shop may confirm it, `done` once it is no draft. */
    readonly approval: OrderApproval
    /** From which amount the owner decides, VND. */
    readonly thresholdVnd: number
    /** Who confirmed it, or null. */
    readonly confirmedBy: string | null
    /** When it was confirmed, ISO text, or null. */
    readonly confirmedAt: string | null
    /** When it was created, ISO text. */
    readonly createdAt: string
    /** When the carrier received it, ISO text, or null. */
    readonly shippedAt: string | null
    /** The carrier, or null. */
    readonly carrier: string | null
    /** The tracking reference, or null. */
    readonly trackingCode: string | null
}

/** The input of an action on one order. */
export interface OrderIdInput {
    /** The order id. */
    readonly id: string
}
