/** The dependency checks required before the API accepts traffic. */
export interface ReadinessChecks {
    /** The primary database answered its probe. */
    readonly database: "ok"
    /** The jobs statistics function returned a check timestamp. */
    readonly jobs: "ok"
    /** The AI endpoint is configured (gateway address and virtual key): model calls can be made. */
    readonly ai: "ok"
    /**
     * The vector index: ok = it answered its last call; down = it did not (the process stays ready: search by meaning answers by
     * words meanwhile); off = the deployment has none and vectors are read from Postgres.
     */
    readonly vectors: "ok" | "down" | "off"
}

/** What a successful readiness probe answers. */
export interface ReadinessReport {
    /** All required dependencies answered within the deadline. */
    readonly status: "ready"
    /** The successful dependency checks. */
    readonly checks: ReadinessChecks
}
