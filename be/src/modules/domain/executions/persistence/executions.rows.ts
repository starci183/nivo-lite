/** The one column the insert answers. */
export interface ExecutionIdRow {
    /** The execution id. */
    id: string
}

/** An approval card as the decision flow reads it. */
export interface ExecutionRow {
    /** The execution id. */
    id: string
    /** `pending_approval`, `approved` or `rejected`. */
    status: string
    /** The work item the card belongs to, when there is one. */
    work_item_id: string | null
    /** The draft the person approves. */
    draft: string
}

/** An approval card selected for a workspace's lead and sales views. */
export interface ExecutionRecordRow extends ExecutionRow {
    /** The workspace that owns the card. */
    readonly workspace_id: string
    /** The responsibility the draft belongs to. */
    readonly responsibility_id: string
    /** The agent that wrote the draft, when there is one. */
    readonly agent_id: string | null
    /** The draft's action kind. */
    readonly kind: string
    /** The person that decided the card, when decided. */
    readonly decided_by: string | null
    /** The decision time selected as ISO 8601 text, when decided. */
    readonly decided_at: string | null
    /** The creation time selected as ISO 8601 text. */
    readonly created_at: string
}
