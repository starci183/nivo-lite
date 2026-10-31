import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { KnowledgeJob, knowledgeDedupeKey } from "./knowledge.contracts"
import type {
    DossierRemedyPayload,
    DossierReviewPayload,
    KnowledgeReembedPayload,
    KnowledgeSourcePayload,
} from "./knowledge.contracts"

/** The queue name: the contract between these producers, the SQL functions that enqueue knowledge sources, and the processors (the durable queue name). */
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

    /** Enqueues the fact extraction of an indexed source in the caller's transaction; `runAt` (epoch ms) keys one reading per indexing, so a source indexed again is read again. */
    enqueueFacts(payload: KnowledgeSourcePayload, tx: EntityManager, runAt?: number): Promise<void> {
        return this.outbox.write(tx, KNOWLEDGE_QUEUE, payload, {
            job: KnowledgeJob.Facts,
            dedupeKey: knowledgeDedupeKey(
                KnowledgeJob.Facts,
                payload.sourceId,
                runAt === undefined ? undefined : `run:${runAt}`,
            ),
        })
    }

    /** Enqueues the re-embedding of a workspace in the caller's transaction; one job per workspace and model, and `continuedAt` (epoch ms) keys the follow-up of a job that hit its batch limit. */
    enqueueReembed(payload: KnowledgeReembedPayload, tx: EntityManager, continuedAt?: number): Promise<void> {
        return this.outbox.write(tx, KNOWLEDGE_QUEUE, payload, {
            job: KnowledgeJob.Reembed,
            dedupeKey: knowledgeDedupeKey(
                KnowledgeJob.Reembed,
                payload.workspaceId,
                continuedAt === undefined ? payload.model : `${payload.model ?? ""}:next:${continuedAt}`,
            ),
        })
    }

    /** Enqueues the review of a dossier run in the caller's transaction; one job per run row. */
    enqueueDossierReview(payload: DossierReviewPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, KNOWLEDGE_QUEUE, payload, {
            job: KnowledgeJob.DossierReview,
            dedupeKey: knowledgeDedupeKey(KnowledgeJob.DossierReview, payload.runId),
        })
    }

    /** Enqueues the writing of a remedy draft in the caller's transaction; one job per draft row. */
    enqueueDossierRemedy(payload: DossierRemedyPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, KNOWLEDGE_QUEUE, payload, {
            job: KnowledgeJob.DossierRemedy,
            dedupeKey: knowledgeDedupeKey(KnowledgeJob.DossierRemedy, payload.draftId),
        })
    }
}
