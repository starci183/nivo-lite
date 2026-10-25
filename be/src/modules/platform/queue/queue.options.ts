import type { Secret } from "@modules/platform/config"
import type { QueueSchedulerDefinition } from "./queue.contracts"

/** What the queues of one app need: where Redis is, how the workers run, the limits the database enforces, and the schedulers it registers. */
export interface QueueOptions {
    /** False keeps the workers and the relay off (producers still enqueue and jobs wait in the outbox): an app that only enqueues sets it. */
    readonly enabled: boolean
    /** The Redis the queues of the deployment live on. */
    readonly redisHost: string
    /** Its port. */
    readonly redisPort: number
    /** The Redis database that holds this app's queue state. */
    readonly redisDb: number
    /** The password of the queue credential, when the deployment sets one (mounted files win over the plain value). */
    readonly redisPassword?: Secret | undefined
    /** The BullMQ key prefix of the app on the shared Redis. */
    readonly prefix: string
    /** How many jobs one queue's worker runs at once, unless its handler asks for another number. */
    readonly concurrency: number
    /** How many jobs of one workspace run at once across every app replica (job_slots), so one workspace cannot starve the others. */
    readonly workspaceConcurrency: number
    /** The pause of the relay after a pass that found no waiting row. */
    readonly relayIntervalMs: number
    /** How many rows one relay pass publishes or reconciles. */
    readonly relayBatch: number
    /** How long a queued row may stay sent without a delivery before the relay checks the broker for it. */
    readonly reconcileAfterMs: number
    /** How long the broker lock of a running job and its workspace slot last; a running handler renews the slot every third of it, and a worker that dies mid-job lets the delivery be recovered after this. */
    readonly visibilityTimeoutMs: number
    /** How long running jobs get to finish on shutdown before they are aborted and handed back. */
    readonly shutdownGraceMs: number
    /** The job schedulers the app registers at boot (pg_cron owns lite's schedules; the slot stays for compatibility). */
    readonly schedulers: ReadonlyArray<QueueSchedulerDefinition>
}
