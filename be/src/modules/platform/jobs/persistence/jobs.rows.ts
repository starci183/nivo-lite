/** One row a claim returns. */
export interface ClaimedRow {
    /** The id of the job row. */
    readonly id: string
    /** The kind of the job. */
    readonly kind: string
    /** The fencing token after the claim (a bigint arrives as text). */
    readonly fencing_token: string
    /** The last recorded step, or null. */
    readonly current_step: string | null
    /** The payload, as the database returns the jsonb value. */
    readonly payload: object
}

/** The latest disposition of a delivery whose claim was refused. */
export interface JobClaimStateRow {
    /** Only done permits the delivery to complete without processing again. */
    readonly status: string
    /** The live worker's lease, if any. */
    readonly lease_expires_at: Date | null
}
