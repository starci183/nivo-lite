/** public.orders as the statements select it. */
export interface OrderRow {
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
}

/** The count of the orders numbered with a prefix. */
export interface OrderCountRow {
    /** How many. */
    readonly n: number
}
