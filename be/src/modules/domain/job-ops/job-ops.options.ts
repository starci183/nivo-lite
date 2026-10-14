/** The app-owned jobs monitor's cadence and thresholds. */
export interface JobsAlertOptions {
    /** Whether this app has an enabled queue consumer to watch. */
    readonly enabled: boolean
    /** How often the monitor reads the jobs statistics, in milliseconds. */
    readonly intervalMs: number
    /** The largest tolerated failure count in the last 24 hours. */
    readonly failedMax: number
    /** The largest tolerated age of the oldest queued job, in seconds. */
    readonly staleSeconds: number
}

/** Jobs operations use the primary connection; only a consuming app enables its alert monitor. */
export interface JobOpsOptions {
    /** Omitted in the CLI, which must not start a background monitor. */
    readonly alerts?: JobsAlertOptions
}
