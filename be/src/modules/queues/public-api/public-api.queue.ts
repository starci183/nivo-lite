import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { PublicApiQueueJob, publicApiDedupeKey } from "./public-api.contracts"
import type { PublicApiRequestPayload } from "./public-api.contracts"

/** The queue name: the contract between this producer and the processor of the public API request job (the durable queue name). */
export const PUBLIC_API_QUEUE = "public_api"

@Injectable()
/** The typed producer of the public-api queue: the one way a request accepted by the public API starts its follow-up work. */
export class PublicApiQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the follow-up of an accepted request in the caller's transaction: the job exists exactly when the ledger row does. */
    enqueueRequest(payload: PublicApiRequestPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, PUBLIC_API_QUEUE, payload, {
            job: PublicApiQueueJob.Request,
            dedupeKey: publicApiDedupeKey(payload.requestId),
        })
    }
}
