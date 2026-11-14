/** Log events of the vector-sync capability. */
export enum VectorSyncLogEvent {
    /** A sync job arrived with a payload of another shape and was dropped. */
    PayloadRefused = "vector.sync.payload_refused",
    /** A sync job brought rows in step with their points (the counts say how). */
    Synced = "vector.sync.done",
    /** The index did not take the vectors a writer handed over; the queued job brings the rows in step. */
    AcceptFailed = "vector.sync.accept_failed",
    /** An adoption could not be tried; the caller embeds instead. */
    AdoptFailed = "vector.sync.adopt_failed",
    /** One run of the reconcile ended (the counts per kind, whether a follow-up was queued). */
    Reconciled = "vector.reconcile.done",
    /** One run of the reconcile stopped on a failure of the index or of an embedding call. */
    ReconcileStopped = "vector.reconcile.stopped",
    /** Drift that outlived its runs was told to a founder (once per episode). */
    DriftReported = "vector.reconcile.drift_reported",
    /** The report of a drift could not be posted. */
    DriftReportFailed = "vector.reconcile.drift_report_failed",
}
