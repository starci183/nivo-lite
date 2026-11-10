/** Log events of the jobs. */
export enum JobsLogEvent {
    /** A write of a stale worker was refused: a newer worker owns the job and this one stopped with no further effect. */
    FencedOut = "jobs.fenced-out",
    /** A handler asked for its job to run again later; the job was given back with no failure, and the queue defers it. */
    Deferred = "jobs.delivery.deferred",
    /** A delivery failed and the job was marked failed for the queue to retry. */
    DeliveryFailed = "jobs.delivery.failed",
    /** A failed delivery could not even be recorded as failed; the lease will expire and the job will be claimed again. */
    FailureNotRecorded = "jobs.delivery.failure-not-recorded",
    /** The lease of a running job could not be renewed (the database failed, not the fence); the next beat tries again. */
    LeaseNotRenewed = "jobs.lease.not-renewed",
    /** A parked job was handed back to its queue. */
    Resumed = "jobs.resumed",
    /** A parked job was closed for good by a person, with the reason. */
    Closed = "jobs.closed",
    /** A recurring tick failed to put its job on the queue; the next firing tries again and the app keeps running. */
    TickFailed = "jobs.tick.failed",
}
