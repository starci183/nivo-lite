import type { OrderKind, OrderStatus } from "../payment-orders.contracts"

/** A JSON column as the driver answers it. */
export type JsonColumnRow = string | number | boolean | null | { [key: string]: JsonColumnRow } | Array<JsonColumnRow>

/** One payment order as the order statements answer it; the amount is cast to float8 in SQL so the driver answers a number. */
export interface OrderRow {
    /** The order id. */
    readonly id: string
    /** The workspace that pays. */
    readonly workspace_id: string
    /** The plan code stored on the order. */
    readonly plan_code: string
    /** The transfer content that identifies the order. */
    readonly order_code: string
    /** When the order stops being payable. */
    readonly expires_at: string
    /** When the transfer settled it, or null. */
    readonly paid_at: string | null
    /** When the order was created. */
    readonly created_at: string
    /** The credit pack of a top-up, or null. */
    readonly pack_code: string | null
    /** What was sold. */
    readonly detail: JsonColumnRow
    /** The amount to transfer in VND. */
    readonly amount_vnd: number
    /** The status, a member of the table check. */
    readonly status: OrderStatus
    /** The kind, a member of the table check. */
    readonly kind: OrderKind
}
