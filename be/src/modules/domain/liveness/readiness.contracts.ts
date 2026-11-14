/** The dependency checks required before the API accepts traffic. */
export interface ReadinessChecks {
    /** The primary database answered its probe. */
    readonly database: "ok"
    /** The jobs statistics function returned a check timestamp. */
    readonly jobs: "ok"
    /** The AI endpoint is configured (gateway address and virtual key): model calls can be made. */
    readonly ai: "ok"
    /** The vector index answered its probe (a required engine piece: a process whose index does not answer is not ready). */
    readonly vectors: "ok"
}

/** What a successful readiness probe answers. */
export interface ReadinessReport {
    /** All required dependencies answered within the deadline. */
    readonly status: "ready"
    /** The successful dependency checks. */
    readonly checks: ReadinessChecks
}
