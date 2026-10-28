/** What the end-of-day sweep keeps and how it deletes. */
export interface HistoryRetentionWindow {
    /** Days a finished success is kept. */
    readonly doneDays: number
    /** Days a failed or dead-lettered job, a failed cron run or a failed http response is kept, so it can still be investigated. */
    readonly failedDays: number
    /** Rows one statement deletes per table, so no long lock blocks the queue. */
    readonly batch: number
}

/** Asks the job fence before a batch: it rejects when this worker no longer holds the job, so no further batch runs. */
export type SweepFence = () => Promise<void>

/** The default window: one day of successes, seven days of failures, 5000 rows per statement. */
export const DEFAULT_RETENTION_WINDOW: HistoryRetentionWindow = { doneDays: 1, failedDays: 7, batch: 5000 }

/** The most batches one pass runs (at 5000 rows per table that clears 1,000,000 rows); the next day's tick continues. */
export const MAX_SWEEP_BATCHES = 200

const DAYS_MAX = 3650
const BATCH_MAX = 20_000

const boundedInteger = (value: unknown, fallback: number, minimum: number, maximum: number): number =>
    typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback

/** Reads the window from the tick payload (the pg_cron command carries it); a missing or invalid member takes the default, and failures are never kept shorter than successes. */
export const retentionWindowOf = (payload: unknown): HistoryRetentionWindow => {
    const given = typeof payload === "object" && payload !== null ? payload : {}
    const doneDays = boundedInteger(Reflect.get(given, "doneDays"), DEFAULT_RETENTION_WINDOW.doneDays, 0, DAYS_MAX)
    const failedDays = boundedInteger(
        Reflect.get(given, "failedDays"),
        DEFAULT_RETENTION_WINDOW.failedDays,
        0,
        DAYS_MAX,
    )
    return {
        doneDays,
        failedDays: Math.max(doneDays, failedDays),
        batch: boundedInteger(Reflect.get(given, "batch"), DEFAULT_RETENTION_WINDOW.batch, 1, BATCH_MAX),
    }
}
