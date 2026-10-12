import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { KnowledgeJob, knowledgeDedupeKey } from "./knowledge.contracts"
import type { KnowledgeReembedPayload, KnowledgeSourcePayload } from "./knowledge.contracts"

/** The queue name: the contract between these producers, the SQL functions that enqueue knowledge sources, and the processors (a pgmq queue name). */
export const KNOWLEDGE_QUEUE = "knowledge"

@Injectable()
/** The typed producer of the knowledge queue: the one way a knowledge job starts from the back end. */
export class KnowledgeQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the indexing of a source in the caller's transaction; `retryAt` (epoch ms) re-runs a source whose first job already ended. */
    enqueueIndex(payload: KnowledgeSourcePayload, tx: EntityManager, retryAt?: number): Promise<void> {
        return this.outbox.write(tx, KNOWLEDGE_QUEUE, payload, {
            job: KnowledgeJob.Index,
            dedupeKey: knowledgeDedupeKey(
                KnowledgeJob.Index,
                payload.sourceId,
                retryAt === undefined ? undefined : `retry:${retryAt}`,
            ),
        })
    }

    /** Enqueues the fact extraction of an indexed source in the caller's transaction. */
    enqueueFacts(payload: KnowledgeSourcePayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, KNOWLEDGE_QUEUE, payload, {
            job: KnowledgeJob.Facts,
            dedupeKey: knowledgeDedupeKey(KnowledgeJob.Facts, payload.sourceId),
        })
    }

    /** Enqueues the re-embedding of a workspace in the caller's transaction; one job per workspace and model. */
    enqueueReembed(payload: KnowledgeReembedPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, KNOWLEDGE_QUEUE, payload, {
            job: KnowledgeJob.Reembed,
            dedupeKey: knowledgeDedupeKey(KnowledgeJob.Reembed, payload.workspaceId, payload.model),
        })
    }
}
