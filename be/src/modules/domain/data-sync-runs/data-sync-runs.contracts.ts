/** How a sync run was started. */
export type DataSyncTrigger = "schedule" | "manual" | "upload" | "push"

/** The state of one sync run. */
export type DataSyncRunState = "running" | "ok" | "failed"

/** One recorded sync run. */
export interface DataSyncRun {
    /** The run id. */
    readonly id: string
    /** The connection it synced. */
    readonly connectionId: string
    /** How it started. */
    readonly trigger: DataSyncTrigger
    /** Where it is. */
    readonly state: DataSyncRunState
    /** How many rows it wrote. */
    readonly rows: number
    /** The failure, when it failed. */
    readonly error: string | null
    /** When it started, ISO 8601. */
    readonly startedAt: string
    /** When it ended, ISO 8601; null while it runs. */
    readonly finishedAt: string | null
}

/** A run that may not exist: the run asked for, or null. */
export type FoundRun = DataSyncRun | null

/** The end state a run settles in: ok when it wrote its rows, failed when it stopped. */
export type SettledRunState = "ok" | "failed"

/** Why a run failed, shown to the owner; null when it succeeded. */
export type RunFailure = string | null
