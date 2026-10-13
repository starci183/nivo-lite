import type { RequestKind } from "../payment-order-requests.contracts"

/** One payment order request as the job reads it. */
export interface RequestRow {
    /** The request id. */
    readonly id: string
    /** The workspace that pays. */
    readonly workspace_id: string
    /** The person who asked. */
    readonly requested_by: string
    /** What they asked to pay, a member of the table check. */
    readonly kind: RequestKind
    /** The plan or pack code, or null for a renewal. */
    readonly target: string | null
    /** Where the request is, a member of the table check. */
    readonly status: "pending" | "done" | "failed"
}
