import type { QueueSchedulerDefinition } from "./queue.contracts"

/** What the queues of one app need: how the workers run, the limits the database enforces, and the schedulers it registers. */
export interface QueueOptions {
    /** False keeps the workers off (producers still enqueue and messages wait): an app that only enqueues sets it. */
    readonly enabled: boolean
    /** How many messages one queue's worker runs at once, unless its handler asks for another number. */
    readonly concurrency: number
    /** How many jobs of one workspace run at once across every app replica (job_slots), so one workspace cannot starve the others. */
    readonly workspaceConcurrency: number
    /** The pause of a worker after a read that found no message. */
    readonly pollIntervalMs: number
    /** How long a read message stays hidden from other readers; a running handler renews it every third of it, and a worker that dies mid-job lets it reappear after this. */
    readonly visibilityTimeoutMs: number
    /** How long running jobs get to finish on shutdown before they are aborted and handed back. */
    readonly shutdownGraceMs: number
    /** The job schedulers the app registers at boot; pg_cron upserts them by id, so a pool of replicas fires each one once per interval. */
    readonly schedulers: ReadonlyArray<QueueSchedulerDefinition>
}
