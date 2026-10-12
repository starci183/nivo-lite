import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The queue name: the contract between this producer and the processor of the public API request job (a pgmq queue name). */
export const PUBLIC_API_QUEUE = "public_api"

/**
 * The payload of one public API request job: ids only. The processor reads the ledger row `public.public_api` named by `requestId`;
 * its `kind` (lead, message or knowledge) says which work to do and its `payload` holds the request body, and it sets `processed_at`.
 */
export interface PublicApiJob {
    /** The ledger row of the accepted request. */
    readonly requestId: string
    /** The workspace of the key that sent the request. */
    readonly workspaceId: string
}

@Injectable()
/** The typed producer of the public-api queue: the one way a request accepted by the public API starts its follow-up work. */
export class PublicApiQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the follow-up of an accepted request in the caller's transaction: the job exists exactly when the ledger row does. */
    enqueueRequest(payload: PublicApiJob, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, PUBLIC_API_QUEUE, payload)
    }
}
