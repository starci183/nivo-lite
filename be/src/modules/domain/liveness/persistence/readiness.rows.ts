/** The part of the jobs statistics required for readiness. */
export interface ReadinessJobStatsRow {
    /** The database check timestamp, absent when no valid check was returned. */
    readonly checkedAt?: string | null
}

/** The jobs statistics function result returned by the primary database. */
export interface ReadinessJobsRow {
    /** Statistics, or null when the function did not return a check. */
    readonly stats: ReadinessJobStatsRow | null
}
