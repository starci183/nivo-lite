/** A campaign joined with its delivery counts. */
export interface LoyaltyCampaignRow {
    /** Campaign id. */
    readonly id: string
    /** Owner-supplied name. */
    readonly name: string
    /** Stored segment. */
    readonly segment: unknown
    /** Customer message. */
    readonly draft: string
    /** Workflow status. */
    readonly status: string
    /** Associated decision. */
    readonly work_item_id: string | null
    /** Intended recipients. */
    readonly recipients: number
    /** Sent deliveries. */
    readonly sent: number
    /** Queued deliveries. */
    readonly queued: number
    /** Failed deliveries. */
    readonly failed: number
    /** Skipped deliveries. */
    readonly skipped: number
    /** Draft duration. */
    readonly draft_ms: number | null
    /** Requester display name. */
    readonly created_by: string
    /** Creation instant. */
    readonly created_at: Date | string
    /** Terminal instant. */
    readonly finished_at: Date | string | null
}
