import type { SalesOrderRow } from "./persistence/orders.rows"

/** Where an order stands. */
export type OrderStatus = "draft" | "confirmed" | "invoiced" | "paid" | "cancelled"

/** Whether the order is real or from the simulator. */
export type OrderOrigin = "live" | "simulated"

/** An order, or null when the workspace has no such order. */
export type OptionalOrder = SalesOrderRow | null

/** What a new draft order takes. */
export interface NewOrderDraft {
    /** The workspace. */
    readonly workspaceId: string
    /** The customer. */
    readonly leadId: string
    /** The input that started it, when there is one. */
    readonly inboundEventId: string | null
    /** The order number the channel gave (an external reference), or null to number it here. */
    readonly orderNo: string | null
    /** What was ordered. */
    readonly items: string
    /** The money, VND, or null when unknown. */
    readonly amountVnd: number | null
    /** Real or simulated. */
    readonly origin: OrderOrigin
}

/** What confirming a draft order takes. */
export interface OrderConfirmation {
    /** The workspace. */
    readonly workspaceId: string
    /** The order. */
    readonly orderId: string
    /** The money, VND, or null. */
    readonly amountVnd: number | null
    /** What was ordered. */
    readonly items: string
    /** The display name of the confirmer. */
    readonly confirmedBy: string
}

/** The number and items of an order, for text that names it. */
export interface OrderLabel {
    /** The order id. */
    readonly id: string
    /** The order number. */
    readonly order_no: string
    /** What was ordered. */
    readonly items: string
}
