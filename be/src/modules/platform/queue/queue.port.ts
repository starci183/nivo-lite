import type { EntityManager } from "typeorm"
import type { QueueHandler, QueueWriteOptions } from "./queue.contracts"

/** The queue outbox: a typed producer writes a job in the transaction of the caller, so it exists exactly when the change that needs it commits. */
export interface QueueOutbox {
    /**
     * Writes the durable job row in the transaction `tx`; the relay publishes it to the broker after the commit.
     * `payload.workspaceId` (a uuid) puts the job under the workspace limit; `options` names the job inside the queue
     * and its identity (the same dedupe key written twice is one job).
     */
    write(tx: EntityManager, queue: string, payload: object, options?: QueueWriteOptions): Promise<void>
}

/** Where a processor registers the handler of its queue; the workers start when the app has registered every handler. */
export interface QueueWorkerRegistry {
    /** Registers the handler under the queue and job it names; a second handler for the same queue and job is a wiring bug and throws. */
    add(handler: QueueHandler): void
}
