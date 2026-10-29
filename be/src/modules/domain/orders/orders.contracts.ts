/** Where an order stands. */
export type OrderStatus = "draft" | "confirmed" | "invoiced" | "paid" | "cancelled"

/** An order, or null when the workspace has no such order. */
export type OptionalOrder = SalesOrderRow | null

/** A workbench order, or null when a guarded shipment changed no row. */
export type OptionalOrdersWorkbench = OrdersWorkbenchRow | null

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

/** A workspace order in the authenticated read contract. */
export interface SalesOrderView {
    /** The order id. */
    readonly id: string
    /** The workspace id. */
    readonly workspaceId: string
    /** The linked lead id. */
    readonly leadId: string | null
    /** The order number. */
    readonly orderNo: string
    /** The ordered items. */
    readonly items: string
    /** The known amount in VND. */
    readonly amountVnd: number | null
    /** The order state. */
    readonly status: string
    /** The person who confirmed the order. */
    readonly confirmedBy: string | null
    /** The confirmation instant. */
    readonly confirmedAt: string | null
    /** The creation instant. */
    readonly createdAt: string
    /** The shipment instant. */
    readonly shippedAt: string | null
    /** The carrier name. */
    readonly carrier: string | null
    /** The tracking reference. */
    readonly trackingCode: string | null
}

/** A selected order read view, absent when the workspace has no such order. */
export type SalesOrderViewLookup = SalesOrderView | null

/** public.orders as the order contract reads it (snake case and ISO 8601 instants, kept for the capabilities that read it). */
export interface SalesOrderRow {
    /** The order id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The customer, when known. */
    readonly lead_id: string | null
    /** The input that started it. */
    readonly inbound_event_id: string | null
    /** The order number, unique per workspace. */
    readonly order_no: string
    /** What was ordered. */
    readonly items: string
    /** The money, VND, or null. */
    readonly amount_vnd: number | null
    /** `draft`, `confirmed`, `invoiced`, `paid` or `cancelled`. */
    readonly status: string
    /** Who confirmed it. */
    readonly confirmed_by: string | null
    /** When the order was confirmed. */
    readonly confirmed_at: string | null
    /** When the order was created. */
    readonly created_at: string
    /** When the carrier received the order. */
    readonly shipped_at: string | null
    /** The carrier handling the shipment. */
    readonly carrier: string | null
    /** The carrier's tracking reference. */
    readonly tracking_code: string | null
}

/** An order with its workspace-scoped customer labels. */
export interface SalesOrderListRow extends SalesOrderRow {
    /** The customer's name. */
    readonly contact_name: string | null
    /** The customer's company. */
    readonly company: string | null
}

/** An order reduced to what a message may name: its number and its customer. */
export interface OrderRef {
    /** The order id. */
    readonly id: string
    /** The order number. */
    readonly orderNo: string
    /** The customer, null when the order has none. */
    readonly leadId: string | null
}

/** An order as the Sales and Lead journey pages display it. */
export interface OrdersWorkbenchRow extends SalesOrderRow {
    /** When it was drafted. */
    readonly created_at: string
    /** When it was confirmed. */
    readonly confirmed_at: string | null
    /** When it was handed to the carrier. */
    readonly shipped_at: string | null
    /** The carrier. */
    readonly carrier: string | null
    /** The carrier's tracking code. */
    readonly tracking_code: string | null
}
