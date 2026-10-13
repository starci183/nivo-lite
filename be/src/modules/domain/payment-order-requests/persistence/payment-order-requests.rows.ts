import type { PaymentOrderRequestKind } from "../payment-order-requests.contracts"

/** One payment order request as the job reads it. */
export interface RequestRow {
    /** The request id. */
    readonly id: string
    /** The workspace that pays. */
    readonly workspace_id: string
    /** The person who asked. */
    readonly requested_by: string
    /** What they asked to pay, a member of the table check. */
    readonly kind: PaymentOrderRequestKind
    /** The plan or pack code, or null for a renewal. */
    readonly target: string | null
    /** The billing cycle asked for, or null. */
    readonly cycle: "monthly" | "annual" | null
    /** The usage tier asked for, or null. */
    readonly tier_credits: number | null
    /** The seats asked for, or null. */
    readonly seats: number | null
    /** Where the request is, a member of the table check. */
    readonly status: "pending" | "done" | "failed"
}

/** The stored outcome of a payment-order request. */
export interface RequestStatusRow {
    /** The request id. */
    readonly id: string
    /** The stored request state. */
    readonly status: RequestRow["status"]
    /** The payment order created by the worker. */
    readonly order_id: string | null
    /** The stable refusal code written by the worker. */
    readonly fault: string | null
}

/** The identity returned by inserting a payment order request. */
export interface InsertedRequestRow {
    /** The new request id. */
    readonly id: string
}
