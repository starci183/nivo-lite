/** Queue counters returned by the existing jobs statistics function. */
export interface JobQueueStats {
    /** The number of messages waiting in the queue. */
    readonly depth: number
    /** The oldest message's age in seconds. */
    readonly oldestAgeSeconds: number
    /** The queue's lifetime message count. */
    readonly total: number
}

/** The JSON object returned by public.job_stats(). */
export interface JobStats {
    /** Queue counters indexed by queue name. */
    readonly queues: Readonly<Record<string, JobQueueStats>>
    /** The number of jobs with an active lease. */
    readonly running: number
    /** The number of jobs that failed in the last 24 hours. */
    readonly failed24h: number
    /** The oldest queued outbox row's age in seconds. */
    readonly oldestQueuedAgeSeconds: number
    /** When the database checked the queues, absent when no valid check was returned. */
    readonly checkedAt?: string | null
}

/** The database statistics object, or null when no statistics are available. */
export type JobStatsResult = JobStats | null

/** The new message's lossless identity, or null when the outbox job cannot be requeued. */
export type JobRequeueResult = string | null

/** Safe columns of one failed outbox job, in the operator output order. */
export interface FailedJob {
    /** The outbox identity used to retry the job. */
    readonly id: string
    /** The registered job name. */
    readonly name: string
    /** The number of attempts made. */
    readonly attempts: number
    /** When the job finished, as ISO text when present. */
    readonly finished_at: string | null
    /** The most recent failure text. */
    readonly last_error: string | null
}

/** Safe columns of one queued or running outbox job, in the operator output order. */
export interface OpenJob {
    /** The outbox identity. */
    readonly id: string
    /** The registered job name. */
    readonly name: string
    /** Whether the job is waiting or being processed. */
    readonly state: "queued" | "running"
    /** The number of attempts made. */
    readonly attempts: number
    /** When the outbox row was created, as ISO text. */
    readonly created_at: string
    /** The most recent failure text. */
    readonly last_error: string | null
}

/** The result of retrying the failed jobs in a selected time window. */
export interface RetryFailedResult {
    /** The number of jobs successfully requeued. */
    readonly requeued: number
    /** The total number of jobs initially eligible for retry. */
    readonly failed: number
}

/** The two counters consumed by the stack watchdog. */
export interface JobsWatchdogResult {
    /** Failed jobs in the last 24 hours, or -1 when statistics are unavailable. */
    readonly failed24h: number
    /** The oldest queued job's age in seconds, or -1 when statistics are unavailable. */
    readonly oldestQueuedAgeSeconds: number
}

/** The terminal output supplied by an operator command. */
export interface JobOpsConsoleOutput {
    /** Writes the supplied text without changing its line endings. */
    write(text: string): unknown
}
