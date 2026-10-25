/** A leased durable row returned by the public reconciliation function. */
export interface ClaimedReconcileJob {
    /** Canonical outbox identity. */
    readonly id: string
    /** Unique current relay lease token. */
    readonly lease_token: string
}
/** A worker admission answered by the public durable start function. */
export interface AdmittedQueueRun {
    /** Started, busy, terminal, or missing. */
    readonly outcome: string
    /** Durable attempt budget consumed. */
    readonly attempt: number
    /** Unique worker fence for this admission. */
    readonly run_token: string
}
