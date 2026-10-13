/** An append-only correction attached to a workspace invoice or bank payment. */
export interface AccountingAdjustmentRow {
    /** The correction id. */
    readonly id: string
    /** The kind of corrected record. */
    readonly target_type: "invoice" | "transaction"
    /** The corrected record id. */
    readonly target_id: string
    /** The human basis of the correction. */
    readonly note: string
    /** The recorded corrected amount, or null for a note only. */
    readonly corrected_amount_vnd: number | null
    /** The member name when this correction was recorded. */
    readonly created_by: string
    /** The append time, ISO text. */
    readonly created_at: string
}
