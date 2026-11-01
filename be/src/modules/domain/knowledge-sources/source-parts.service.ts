import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EntityManager } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { eachInOrder } from "@modules/platform/primitives"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import type { DeletedSource } from "./knowledge-sources.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { removedTitle } from "./persistence/knowledge-source.projection"
import { partOriginOf, partTitleOf } from "./source-parts.policy"

/** The most later parts a document has: a source may be at most `MAX_SOURCE_CHARS` and a file at most `MAX_UPLOAD_BYTES`, far fewer than this. */
const PARTS_MAX = 500

@Injectable()
/** The later parts of a document longer than a source may be: made their own sources, followed in their metadata, and removed with the first. */
export class SourcePartsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly queue: KnowledgeQueue,
        private readonly progress: KnowledgeProgressService,
    ) {}

    /**
     * The first part stays in the source `sourceId`; each later part becomes a text source of its own, with the same agent, topic, tags,
     * visibility and owner, queued for indexing. The parts a former reading made are removed first, so reading a document again never
     * leaves two copies. Answers the title of the first part.
     */
    async splitLong(
        workspaceId: string,
        sourceId: string,
        title: string,
        later: ReadonlyArray<string>,
    ): Promise<string> {
        const total = later.length + 1
        const created = await this.entityManager.transaction(async (tx) => {
            const first = await tx.findOne(KnowledgeSourceEntity, { where: { id: sourceId, workspaceId } })
            await tx.delete(KnowledgeSourceEntity, { workspaceId, origin: partOriginOf(sourceId) })
            if (first === null) return []
            const parts = later.map((content, index): Partial<KnowledgeSourceEntity> => ({
                workspaceId,
                module: first.module,
                installationId: first.installationId,
                kind: "text",
                topic: first.topic,
                tags: [...first.tags],
                visibility: first.visibility,
                title: partTitleOf(title, index + 2, total),
                content,
                status: "queued",
                progress: 0,
                origin: partOriginOf(sourceId),
                sizeBytes: 0,
                createdBy: first.createdBy,
            }))
            const inserted = await tx.insert(KnowledgeSourceEntity, parts)
            const ids = inserted.identifiers.flatMap((row) => (typeof row.id === "string" ? [row.id] : []))
            await eachInOrder(ids, (id) => this.queue.enqueueIndex({ sourceId: id, workspaceId }, tx))
            return ids
        })
        await eachInOrder(created, (id) => this.progress.announce(workspaceId, id))
        return partTitleOf(title, 1, total)
    }

    /**
     * Deletes a source with its passages and the later parts of a long document in one transaction: the owner sees one document, so
     * deleting it never leaves parts behind. Answers the title and the parts, for the brain to take back what each contributed.
     */
    removeWhole(workspaceId: string, sourceId: string): Promise<DeletedSource> {
        return this.entityManager.transaction(async (tx) => {
            const later = await tx.find(KnowledgeSourceEntity, {
                select: { id: true, title: true },
                where: { workspaceId, origin: partOriginOf(sourceId) },
                take: PARTS_MAX,
            })
            const removed = await tx
                .createQueryBuilder(KnowledgeSourceEntity, "ks")
                .delete()
                .where({ id: sourceId, workspaceId })
                .returning("title")
                .execute()
            const title = removedTitle(removed.raw)
            if (title === undefined) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
            await tx.delete(KnowledgeSourceEntity, { workspaceId, origin: partOriginOf(sourceId) })
            return { title, parts: later.map((part) => ({ id: part.id, title: part.title })) }
        })
    }

    /** Gives the later parts of a long document the change made to its first: the same agents and audience read all of it. */
    async follow(
        workspaceId: string,
        sourceId: string,
        changes: QueryDeepPartialEntity<KnowledgeSourceEntity>,
    ): Promise<void> {
        await this.entityManager.update(KnowledgeSourceEntity, { workspaceId, origin: partOriginOf(sourceId) }, changes)
    }
}
