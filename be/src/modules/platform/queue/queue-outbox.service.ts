import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { QueueWriteOptions } from "./queue.contracts"
import { jobOf } from "./queue.policy"
import type { QueueOutbox } from "./queue.port"
import { JOB_ENQUEUE } from "./persistence/queue.sql"

@Injectable()
/**
 * The writing side of the queues. A job is a durable outbox row of the caller's transaction, so it exists exactly when
 * the change that needs it commits; nothing reaches Redis inside that transaction. The relay publishes the committed
 * rows to BullMQ and re-enqueues what the broker lost, so a committed job is never lost.
 */
export class QueueOutboxService implements QueueOutbox {
    /** Resolves the job (its name, identity and workspace) and writes its outbox row inside the transaction `tx`. */
    async write(tx: EntityManager, queue: string, payload: object, options: QueueWriteOptions = {}): Promise<void> {
        const job = jobOf(queue, payload, options)
        await tx.query(JOB_ENQUEUE, [job.workspaceId, job.queue, job.job, JSON.stringify(job.payload), job.dedupeKey])
    }
}
