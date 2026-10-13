/** The correction request over a workspace record. */
export interface NewAccountingAdjustment {
    /** The kind of record being corrected. */
    readonly targetType: "invoice" | "transaction"
    /** The record id. */
    readonly targetId: string
    /** The human basis, five to one thousand characters after normalization. */
    readonly note: string
    /** The corrected VND amount, or null for a note only. */
    readonly correctedAmount?: number | null
}

/** A validated correction with a normalized note and explicitly nullable amount. */
export interface NormalizedAccountingAdjustment extends NewAccountingAdjustment {
    /** The corrected amount, or null for a note only. */
    readonly correctedAmount: number | null
}
