import type { JobStats, RetryFailedResult } from "../job-ops.contracts"

/** The JSON value returned by the existing statistics function. */
export interface JobStatsRow {
    /** Database statistics, or null when no statistics were returned. */
    readonly stats: JobStats | null
}

/** Safe columns returned by the failed-jobs function. */
export interface FailedJobRow {
    /** The outbox identity used to retry the job. */
    readonly id: string
    /** The registered job name. */
    readonly name: string
    /** The number of attempts made. */
    readonly attempts: number
    /** The completion instant, when present. */
    readonly finished_at: string | Date | null
    /** The most recent failure text. */
    readonly last_error: string | null
}

/** Safe columns returned by the open-jobs function. */
export interface OpenJobRow {
    /** The outbox identity. */
    readonly id: string
    /** The registered job name. */
    readonly name: string
    /** Whether the job is waiting or being processed. */
    readonly state: "queued" | "running"
    /** The number of attempts made. */
    readonly attempts: number
    /** The creation instant. */
    readonly created_at: string | Date
    /** The most recent failure text. */
    readonly last_error: string | null
}

/** The result of the existing requeue function. */
export interface JobRequeueRow {
    /** The new bigint message id as lossless text, or null when the job was not failed. */
    readonly message_id: string | null
}

/** The JSON value returned by the bulk retry function. */
export interface JobRequeueFailedRow {
    /** The requeued and initially eligible job counts. */
    readonly result: RetryFailedResult
}

/** Rows one sweep batch deleted, per table. */
export interface HistorySweepCountsRow {
    /** Finished queue outbox rows. */
    readonly outbox: number
    /** Finished job fencing rows. */
    readonly jobs: number
    /** pg_cron run log rows. */
    readonly cron: number
    /** pg_net response rows. */
    readonly http: number
}

/** The JSON value returned by the system history sweep. */
export interface HistorySweepRow {
    /** The per-table counts of this batch. */
    readonly result: HistorySweepCountsRow
}
