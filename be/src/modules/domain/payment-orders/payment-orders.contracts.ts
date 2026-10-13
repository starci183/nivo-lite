/** Where one payment order is. */
export type OrderStatus = "pending" | "paid" | "expired" | "cancelled"

/** Plan: first payment or renewal. Upgrade: a higher plan for the prorated difference. Topup: a pack of extra credits. */
export type OrderKind = "plan" | "upgrade" | "topup"

/** An order, or null when none matches. */
export type OrderLookup = PaymentOrder | null

/** What was sold on an order, frozen when the order was made (credits of a top-up, the proration inputs of an upgrade). */
export type OrderDetail = Readonly<Record<string, unknown>>

/** One payment order: a transfer the customer has to make, identified by its order code. */
export interface PaymentOrder {
    /** The order id. */
    readonly id: string
    /** The workspace that pays. */
    readonly workspaceId: string
    /** The plan the order is for (the workspace's own plan for a top-up). */
    readonly planCode: string
    /** The amount to transfer in VND. */
    readonly amountVnd: number
    /** The transfer content that identifies the order. */
    readonly orderCode: string
    /** The status. */
    readonly status: OrderStatus
    /** When the order stops being payable, ISO 8601. */
    readonly expiresAt: string
    /** When the transfer settled it, ISO 8601, or null. */
    readonly paidAt: string | null
    /** When the order was created, ISO 8601. */
    readonly createdAt: string
    /** What the order buys. */
    readonly kind: OrderKind
    /** The credit pack of a top-up, or null. */
    readonly packCode: string | null
    /** What was sold. */
    readonly detail: OrderDetail
}

/** What a new payment order is made of. */
export interface NewOrder {
    /** The workspace that pays. */
    readonly workspaceId: string
    /** The person who asked. */
    readonly userId: string
    /** The plan code stored on the order. */
    readonly planCode: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** The kind of order. */
    readonly kind: OrderKind
    /** The credit pack of a top-up, or null. */
    readonly packCode: string | null
    /** What was sold. */
    readonly detail: OrderDetail
}

/** What an already-open order is looked for by: the workspace, the pack or plan it is for and its amount. */
export interface OpenOrderQuery {
    /** The workspace that pays. */
    readonly workspaceId: string
    /** The credit pack (top-up) or the target plan (upgrade). */
    readonly target: string
    /** The amount in VND. */
    readonly amountVnd: number
}
