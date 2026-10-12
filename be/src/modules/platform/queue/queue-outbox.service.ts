import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueTransport } from "./queue.decorators"
import type { QueueWriteOptions } from "./queue.contracts"
import { jobOf } from "./queue.policy"
import type { QueueOutbox } from "./queue.port"
import type { QueueTransport } from "./queue-transport.port"

@Injectable()
/**
 * The writing side of the queues. pgmq lives in the same Supabase PostgreSQL as the business rows, so the outbox row of a job and its
 * pgmq message are both written in the caller's transaction: the job exists, and is already on its queue, exactly when the change that
 * needs it commits. There is no relay to wait for.
 */
export class QueueOutboxService implements QueueOutbox {
    constructor(@InjectQueueTransport() private readonly transport: QueueTransport) {}

    /** Resolves the job (its name, identity and workspace) and writes it inside the transaction `tx`. */
    async write(tx: EntityManager, queue: string, payload: object, options: QueueWriteOptions = {}): Promise<void> {
        await this.transport.add(tx, jobOf(queue, payload, options))
    }
}
