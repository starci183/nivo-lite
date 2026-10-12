import type { EntityManager } from "typeorm"
import type { QueueHandler, QueueJob, QueueSchedulerDefinition } from "./queue.contracts"

/** Supabase Queues (pgmq) as the queue capability sees it: the one port the pgmq client implements. */
export interface QueueTransport {
    /** Writes the job's outbox row and sends its message, inside the transaction `tx`: both exist exactly when `tx` commits. */
    add(tx: EntityManager, job: QueueJob): Promise<void>
    /** Creates or updates a job scheduler (a pg_cron job) by its id. */
    upsertScheduler(scheduler: QueueSchedulerDefinition): Promise<void>
    /** Starts a worker of the queue the handler names that runs it for every message, `concurrency` at a time. */
    work(handler: QueueHandler, concurrency: number): Promise<void>
    /** Resolves after `ms` milliseconds: the only clock of the worker loops. */
    wait(ms: number): Promise<void>
    /** Stops reading, gives the running deliveries the shutdown grace, then aborts and hands back what is left. */
    close(): Promise<void>
}
