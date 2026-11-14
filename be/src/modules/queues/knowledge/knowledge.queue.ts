import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox, type QueueOutbox } from "@modules/platform/queue"
import {
    KnowledgeJob,
    knowledgeDedupeKey,
    type DossierReviewPayload,
    type PolicyDerivePayload,
    type PublicDraftPayload,
    type KnowledgeSourcePayload,
} from "./knowledge.contracts"

/** The queue name: the contract between these producers, the SQL functions that enqueue knowledge sources, and the processors (the durable queue name). */
export const KNOWLEDGE_QUEUE = "knowledge"

/**
 * The index lane of the knowledge capability: the index jobs only, on workers of their own. A document is searchable as soon as it is
 * stored (`extensions.ingestionTwoPaths`), so its indexing (seconds per part) never waits for a worker that the truths work of the
 * same queue holds (facts, critique, follow-ups: minutes per document, hundreds of jobs for a big upload; brain walk 2 D-N-6 measured
 * waits of up to 20 minutes for a 2.9 s job). The job name and the dedupe key stay `knowledge.index:<source>`. The legacy SQL
 * functions `knowledge_enqueue_source` / `knowledge_retry_source` (no caller in be or fe) still name `knowledge`; their owner moves them.
 */
export const KNOWLEDGE_INDEX_QUEUE = "knowledge_index"

@Injectable()
/** The typed producer of the knowledge queue: the one way a knowledge job starts from the back end. */
export class KnowledgeQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /**
     * Enqueues the indexing of a source in the caller's transaction, on the index lane (`KNOWLEDGE_INDEX_QUEUE`); `retryAt` (epoch ms)
     * re-runs a source whose first job already ended.
     */
    enqueueIndex(payload: KnowledgeSourcePayload, tx: EntityManager, retryAt?: number): Promise<void> {
        return this.outbox.write(tx, KNOWLEDGE_INDEX_QUEUE, payload, {
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

    /**
     * Enqueues the follow-up of a facts job that read its budget of windows: the same reading goes on from the window it reached.
     * `step` (the text fingerprint and the windows read) keys it, so a retried job that reached the same point queues nothing twice.
     */
    enqueueFactsNext(payload: KnowledgeSourcePayload, tx: EntityManager, step: string): Promise<void> {
        return this.outbox.write(tx, KNOWLEDGE_QUEUE, payload, {
            job: KnowledgeJob.Facts,
            dedupeKey: knowledgeDedupeKey(KnowledgeJob.Facts, payload.sourceId, `next:${step}`),
        })
    }

    /** Enqueues a run of the shop-document critic in the caller's transaction; one job per run row. */
    enqueueDossierReview(payload: DossierReviewPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, KNOWLEDGE_QUEUE, payload, {
            job: KnowledgeJob.DossierReview,
            dedupeKey: knowledgeDedupeKey(KnowledgeJob.DossierReview, payload.runId),
        })
    }

    /** Enqueues one document revision in the caller's transaction; a repeated enqueue is the same durable job. */
    enqueuePublicDraft(payload: PublicDraftPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, KNOWLEDGE_QUEUE, payload, {
            job: KnowledgeJob.PublicDraft,
            dedupeKey: knowledgeDedupeKey(
                KnowledgeJob.PublicDraft,
                payload.documentId,
                `revision:${payload.draftRevision}`,
            ),
        })
    }

    /**
     * Enqueues one derive pass of a workspace's policies in the caller's transaction. `askedAt` (epoch ms) keys the pass: the
     * caller writes it only when no pass waits (the state row of the workspace says so), so a burst of fact changes is one job.
     */
    enqueuePolicyDerive(payload: PolicyDerivePayload, tx: EntityManager, askedAt: number): Promise<void> {
        return this.outbox.write(tx, KNOWLEDGE_QUEUE, payload, {
            job: KnowledgeJob.PolicyDerive,
            dedupeKey: knowledgeDedupeKey(KnowledgeJob.PolicyDerive, payload.workspaceId, `at:${askedAt}`),
        })
    }
}
