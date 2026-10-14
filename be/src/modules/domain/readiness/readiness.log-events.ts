/** Log events of the readiness capability. */
export enum ReadinessLogEvent {
    /** The required primary database did not answer the read-only readiness query in time. */
    DatabaseUnavailable = "readiness.database.unavailable",
}
