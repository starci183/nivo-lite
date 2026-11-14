/** Log events of the derived policy layer: ids, counts and outcomes only, never a fact's words. */
export enum PolicyDeriveLogEvent {
    /** A fact change could not ask for a derive pass (the fact write stands); the next change or the backfill door asks again. */
    RequestFailed = "brain.policies.request_failed",
    /** A derive pass ended; the outcome and the counts say how. */
    PassEnded = "brain.policies.pass_ended",
    /** The model gave no usable answer for a batch; the pass is retried by the queue, or given up after the third try. */
    BatchFailed = "brain.policies.batch_failed",
    /** A batch's answer was cut at the token cap: booked with what it spent, and split in two halves judged next (a pass converges). */
    BatchCut = "brain.policies.batch_cut",
    /** A pass was given up (three tries, or the queue's retries ran out): the tab shows `failed` until the next change or the door. */
    GaveUp = "brain.policies.gave_up",
    /** The founder was told in /chat that the pass stopped (NIVO's `background.stopped` card): posted, or already posted this episode. */
    StopReported = "brain.policies.stop_reported",
    /** Telling the founder that the pass stopped failed (the failed state stands; the tab still shows it). */
    StopReportFailed = "brain.policies.stop_report_failed",
    /** A derive job arrived with a payload of another shape and was dropped. */
    PayloadRefused = "brain.policies.payload_refused",
    /** The backfill door asked for a pass in the workspaces that had none. */
    Backfilled = "brain.policies.backfilled",
}
