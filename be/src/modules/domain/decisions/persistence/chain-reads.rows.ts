/** The answer of the pending follow-up probe. */
export interface PendingRow {
    /** True when a follow-up of the customer already waits for a decision. */
    pending: boolean
}

/** The stage of a lead, as the chain reads it. */
export interface LeadStageRow {
    /** The stage. */
    stage: string
}
