/** One data_sync_runs row as the service reads it. */
export interface DataSyncRunRow {
    /** The run id. */
    readonly id: string
    /** The connection it synced. */
    readonly connection_id: string
    /** How it started. */
    readonly trigger: string
    /** running, ok or failed. */
    readonly status: string
    /** How many rows it wrote. */
    readonly rows_upserted: number
    /** The failure, when it failed. */
    readonly error: string | null
    /** When it started, ISO 8601 text. */
    readonly started_at: string
    /** When it ended, ISO 8601 text; null while it runs. */
    readonly finished_at: string | null
}

/** The id an insert answers. */
export interface DataRunIdRow {
    /** The run id. */
    readonly id: string
}

/** A count of hub rows. */
export interface DataCountRow {
    /** How many. */
    readonly n: number
}
