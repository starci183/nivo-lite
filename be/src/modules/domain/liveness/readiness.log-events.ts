/** The structured log events of the readiness probe. */
export enum ReadinessLogEvent {
    /** A dependency failed, timed out, or returned no check timestamp. */
    CheckFailed = "liveness.readiness-check-failed",
}
