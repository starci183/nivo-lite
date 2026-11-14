import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { NOW } from "./source-input.policy"

/** A document that waits for credits, as the upkeep tick reads it. */
export interface BlockedSource {
    /** The document. */
    readonly id: string
    /** Its workspace: the pool that must have credits again. */
    readonly workspaceId: string
}

@Injectable()
/**
 * The documents that wait for CREDITS (`blocked_credits`: their passages are stored and searchable by words, without vectors, or
 * their file still needs a model call to be read) and how they go on by themselves: the upkeep tick lists them across workspaces
 * and, once a workspace's pool allows a call, puts each back on the index queue. Running out of credits never fails a document
 * and nothing waits for a button; the founder's own retry (`KnowledgeSourcesService.retrySource`) does the same move.
 */
export class BlockedSourcesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly queue: KnowledgeQueue,
        private readonly progress: KnowledgeProgressService,
    ) {}

    /**
     * The documents that wait for credits, the longest-waiting first, at most `limit`, across workspaces
     * (`knowledge_sources_blocked_credits`, migration 20261112022000).
     */
    async waiting(limit: number): Promise<ReadonlyArray<BlockedSource>> {
        const rows = await this.entityManager.find(KnowledgeSourceEntity, {
            select: { id: true, workspaceId: true },
            where: { status: "blocked_credits" },
            order: { updatedAt: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({ id: row.id, workspaceId: row.workspaceId }))
    }

    /**
     * Puts a document that waits for credits back on the index queue. Only a `blocked_credits` document moves, and its job is queued
     * in the same transaction, so two ticks never queue it twice. Answers whether THIS call moved it.
     */
    async resume(workspaceId: string, sourceId: string): Promise<boolean> {
        const queued = await this.entityManager.transaction(async (tx) => {
            const requeued = await tx.update(
                KnowledgeSourceEntity,
                { id: sourceId, workspaceId, status: "blocked_credits" },
                { status: "queued", progress: 0, error: null, stage: null, stageDone: null, stageTotal: null, updatedAt: NOW },
            )
            if (requeued.affected === 0) return false
            await this.queue.enqueueIndex({ sourceId, workspaceId }, tx, this.clock.now().getTime())
            return true
        })
        if (queued) await this.progress.announce(workspaceId, sourceId)
        return queued
    }
}
