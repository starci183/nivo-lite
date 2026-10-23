/** The authoritative outbox state of a workspace job exposed through the backend status function. */
export interface QueueJobStatus {
    /** The stable queue outbox id. */
    readonly id: string
    /** Retried work is queued; only archived work is failed. */
    readonly state: "queued" | "running" | "done" | "failed"
    /** How many deliveries have started. */
    readonly attempts: number
}

/** The selected job's state, or null when the workspace has no matching job. */
export type OptionalQueueJobStatus = QueueJobStatus | null

/** A recurring task: pg_cron upserts it by `id`, so every replica of an app may register it and the deployment still fires it once per interval. */
export interface QueueSchedulerDefinition {
    /** The queue the ticks go to; its processor handles every tick like any other job. */
    readonly queue: string
    /** The job name of every tick; the queue name when absent, like a job written without a name. */
    readonly job?: string
    /** The stable id of the scheduler: the pg_cron job name. */
    readonly id: string
    /** The interval between two ticks, in milliseconds. */
    readonly everyMs: number
    /** The payload of every tick. */
    readonly payload?: object
}

/** One job as a handler receives it. */
export interface QueueDelivery {
    /** The job id: the outbox row id of an enqueued job (stable across its retries), `<queue>:<message id>` of a scheduled tick. */
    readonly id: string
    /** The queue. */
    readonly queue: string
    /** The job name inside the queue: what to do with the payload. */
    readonly job: string
    /** The payload the producer wrote. */
    readonly payload: object
    /** How many times this job really started, this delivery included (a deferral for the workspace limit does not count). */
    readonly attempt: number
    /** Aborted when the app shuts down and the job is handed back: stop at the next safe point. */
    readonly signal: AbortSignal
}

/** What a producer adds to a job beyond its payload. */
export interface QueueWriteOptions {
    /** The job name; the queue name when absent. */
    readonly job?: string
    /** The identity of the job (`<job>:<subject>`): the same key written twice is one job. A fresh key per write when absent. */
    readonly dedupeKey?: string | undefined
}

/** One job to send, resolved: what the transport writes to the outbox and pgmq in the caller's transaction. */
export interface QueueJob {
    /** The queue. */
    readonly queue: string
    /** The job name. */
    readonly job: string
    /** The identity of the job: the unique outbox key; null lets the database mint a fresh one. */
    readonly dedupeKey: string | null
    /** The workspace the job belongs to (its slot limit is per workspace), or null for work that belongs to none. */
    readonly workspaceId: string | null
    /** The payload. */
    readonly payload: object
}

/**
 * The handler of one queue, or of one job of it: it receives every delivery it names; a return acknowledges the message, a throw lets the
 * worker retry it, and a `QueueError` of code Unrecoverable or Retry ends or delays it as that error says.
 */
export interface QueueHandler {
    /** The queue this handler consumes. */
    readonly queue: string
    /** The only job name of the queue it handles; every job of the queue without a handler of its own when absent. */
    readonly job?: string | undefined
    /** At most this many deliveries of the queue run at once; the app default when absent. */
    readonly concurrency?: number | undefined
    /** Handles one delivery. */
    handle(delivery: QueueDelivery): Promise<void>
    /** Runs once when the job ends as failed (attempts used up or an unrecoverable error): write the failure the owner sees. */
    failed?(delivery: QueueDelivery, cause: unknown): Promise<void>
}
