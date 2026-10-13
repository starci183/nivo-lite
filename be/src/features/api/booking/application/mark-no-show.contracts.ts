/** What mark-no-show takes. */
export interface MarkNoShowRequest {
    /** The workspace id. */
    readonly workspaceId: string
    /** The id. */
    readonly id: string
}

/** What mark-no-show answers. */
export interface MarkNoShowResult {
    /** The status. */
    readonly status: "requested" | "confirmed" | "rescheduled" | "cancelled" | "no_show" | "done"
    /** The fee due. */
    readonly feeDue: boolean
}
