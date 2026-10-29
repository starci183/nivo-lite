import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction } from "@modules/platform/database"
import type { QueueWriteOptions } from "./queue.contracts"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import { jobOf } from "./queue.policy"
import type { QueueOutbox } from "./queue.port"

/** The identity of a job written with none: its name and a fresh uuid from the database's own random source, so two such writes never collapse. */
const freshDedupeKey = async (tx: EntityManager, job: string): Promise<string> => {
    const [minted] = await callDbFunction<{ gen_random_uuid: string }>(tx, "gen_random_uuid", [])
    if (minted === undefined) throw new QueueError({ code: QueueErrorCode.IdentityUnavailable })
    return `${job}:${minted.gen_random_uuid}`
}

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
        const dedupeKey = job.dedupeKey ?? (await freshDedupeKey(tx, job.job))
        await callDbFunction(tx, "public.job_enqueue", [
            job.workspaceId,
            job.queue,
            job.job,
            JSON.stringify(job.payload),
            dedupeKey,
        ])
    }
}
