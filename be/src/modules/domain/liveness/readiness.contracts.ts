/** The dependency checks required before the API accepts traffic. */
export interface ReadinessChecks {
    /** The primary database answered its probe. */
    readonly database: "ok"
    /** The jobs statistics function returned a check timestamp. */
    readonly jobs: "ok"
}

/** What a successful readiness probe answers. */
export interface ReadinessReport {
    /** All required dependencies answered within the deadline. */
    readonly status: "ready"
    /** The successful dependency checks. */
    readonly checks: ReadinessChecks
}
