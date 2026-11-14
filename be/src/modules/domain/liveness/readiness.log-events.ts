/** The structured log events of the readiness probe. */
export enum ReadinessLogEvent {
    /** A dependency failed, timed out, or returned no check timestamp. */
    CheckFailed = "liveness.readiness-check-failed",
    /** The AI endpoint is not configured (no gateway address or no virtual key): the process is not ready. */
    AiUnconfigured = "liveness.readiness-ai-unconfigured",
    /** The vector index did not answer its probe: the process is not ready (no other store of vectors exists). */
    VectorIndexDown = "liveness.readiness-vector-index-down",
}
