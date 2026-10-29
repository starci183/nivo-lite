/** A request for approval that has ended, as the decision history lists it. */
export interface ResolvedRequestLine {
    /** The request id. */
    readonly id: string
    /** The module the request was made for. */
    readonly department: string
    /** The action key. */
    readonly action: string
    /** How it ended. */
    readonly status: "approved" | "rejected" | "expired"
    /** The member whose verdict settled it, or null when it expired. */
    readonly resolvedBy: string | null
    /** The chain step the request waits for. */
    readonly chainStepId: string
    /** When it ended, else when it was made. */
    readonly at: Date
}

/** What a page of resolved requests is narrowed to; a null field does not narrow. */
export interface ResolvedRequestsFilter {
    /** The module to keep. */
    readonly department: string | null
    /** The ending to keep. */
    readonly status: string | null
    /** How many lines to skip, newest first. */
    readonly skip: number
    /** How many lines at most. */
    readonly limit: number
}
