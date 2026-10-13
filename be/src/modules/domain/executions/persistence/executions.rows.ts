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
