/** Log events of the jobs operations capability. */
export enum JobOpsLogEvent {
    /** The statistics check failed; the watchdog receives its unknown counters. */
    WatchdogUnavailable = "job-ops.watchdog.unavailable",
    /** Statistics are unavailable, so the monitor skips this check. */
    AlertUnavailable = "job-ops.alert.unavailable",
    /** Too many jobs failed in the last 24 hours. */
    AlertFailedJobs = "job-ops.alert.failed-jobs",
    /** A queued job has exceeded the tolerated age. */
    AlertJobsStale = "job-ops.alert.jobs-stale",
    /** An unexpected monitor failure is recovered at the timer boundary. */
    AlertMonitorFailed = "job-ops.alert.monitor-failed",
}
