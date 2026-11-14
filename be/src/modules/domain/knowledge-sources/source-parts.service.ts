import { Injectable, Optional } from "@nestjs/common"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { IsNull, Not, type EntityManager } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { eachInOrder } from "@modules/platform/primitives"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { VectorSyncService } from "@modules/domain/vector-sync"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import { PUBLIC_DOCUMENT_ORIGIN, type DeletedSource } from "./knowledge-sources.contracts"
import { type MaybeWholeDocument } from "./source-areas.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { removedTitle } from "./persistence/knowledge-source.projection"
import { changesReaders } from "./source-input.policy"
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
        @Optional() private readonly vectorSync?: VectorSyncService,
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
                .where([
                    { id: sourceId, workspaceId, origin: IsNull() },
                    { id: sourceId, workspaceId, origin: Not(PUBLIC_DOCUMENT_ORIGIN) },
                ])
                .returning("title")
                .execute()
            const title = removedTitle(removed.raw)
            if (title === undefined) {
                const existing = await tx.findOne(KnowledgeSourceEntity, {
                    select: { id: true, origin: true },
                    where: { id: sourceId, workspaceId },
                })
                throw new KnowledgeSourcesError({
                    code:
                        existing?.origin === PUBLIC_DOCUMENT_ORIGIN
                            ? KnowledgeSourcesErrorCode.PublicByApproval
                            : KnowledgeSourcesErrorCode.SourceNotFound,
                })
            }
            await tx.delete(KnowledgeSourceEntity, { workspaceId, origin: partOriginOf(sourceId) })
            // The vector index lets go of the document and its parts: the sync event commits with the delete (QDRANT-2 contract).
            await this.sourcesChanged(workspaceId, [sourceId, ...later.map((part) => part.id)], tx)
            return { title, parts: later.map((part) => ({ id: part.id, title: part.title })) }
        })
    }

    /** Gives the later parts of a long document the change made to its first: the same agents and audience read all of it. */
    async follow(
        workspaceId: string,
        sourceId: string,
        changes: QueryDeepPartialEntity<KnowledgeSourceEntity>,
        tx: EntityManager = this.entityManager,
    ): Promise<void> {
        const where = { workspaceId, origin: partOriginOf(sourceId) }
        await tx.update(KnowledgeSourceEntity, where, changes)
        if (!changesReaders(changes) || this.vectorSync === undefined) return
        const parts = await tx.find(KnowledgeSourceEntity, { select: { id: true }, where, take: PARTS_MAX })
        await this.sourcesChanged(
            workspaceId,
            parts.map((part) => part.id),
            tx,
        )
    }

    /** A whole document as a move reads it, in the caller's transaction: its first source and later parts; null when it is gone. */
    async wholeOf(
        workspaceId: string,
        sourceId: string,
        tx: EntityManager = this.entityManager,
    ): Promise<MaybeWholeDocument> {
        const first = await tx.findOne(KnowledgeSourceEntity, {
            select: { id: true, title: true, visibility: true, origin: true },
            where: { id: sourceId, workspaceId },
        })
        if (first === null) return null
        const later = await tx.find(KnowledgeSourceEntity, {
            select: { id: true },
            where: { workspaceId, origin: partOriginOf(sourceId) },
            take: PARTS_MAX,
        })
        return {
            ids: [sourceId, ...later.map((part) => part.id)],
            title: first.title,
            visibility: first.visibility,
            origin: first.origin,
        }
    }

    /** The `vector.sync` event of each source, in the caller's transaction; nothing when the deployment has no vector index. */
    async sourcesChanged(workspaceId: string, sourceIds: ReadonlyArray<string>, tx: EntityManager): Promise<void> {
        await eachInOrder(sourceIds, (id) => this.vectorSync?.changedSource(workspaceId, id, tx) ?? Promise.resolve())
    }
}
