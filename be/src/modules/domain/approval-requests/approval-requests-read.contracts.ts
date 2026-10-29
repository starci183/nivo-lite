/** A request for approval that has ended, and how. */
export interface SettledRequest {
    /** The request id. */
    readonly id: string
    /** How it ended. */
    readonly status: "approved" | "rejected" | "expired"
    /** The member whose verdict settled it, or null when it expired. */
    readonly resolvedBy: string | null
}
