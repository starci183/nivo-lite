/** State of the existing decisions queue outbox entry. */
export interface LeadGenCommentJobRow {
    /** State of the existing decisions queue entry. */
    readonly state: "queued" | "running" | "done" | "failed"
}
