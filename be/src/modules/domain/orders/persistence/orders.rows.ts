/** public.orders as the statements select it. */
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
    /** `live` or `simulated`. */
    readonly origin: string
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

/** The count of the orders numbered with a prefix. */
export interface OrderCountRow {
    /** How many. */
    readonly n: number
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
