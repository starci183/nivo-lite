/** The correction request over a workspace record. */
export interface NewAccountingAdjustment {
    /** The kind of record being corrected. */
    readonly targetType: "invoice" | "transaction"
    /** The record id. */
    readonly targetId: string
    /** The human basis, five to one thousand characters after normalization. */
    readonly note: string
    /** The corrected VND amount, or null for a note only. */
    readonly correctedAmount?: number | null | undefined
}

/** A validated correction with a normalized note and explicitly nullable amount. */
export interface NormalizedAccountingAdjustment extends NewAccountingAdjustment {
    /** The corrected amount, or null for a note only. */
    readonly correctedAmount: number | null
}

/** A recorded correction as the callers read it. */
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
