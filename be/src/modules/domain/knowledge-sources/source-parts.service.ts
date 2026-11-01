import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EntityManager } from "typeorm"
import { eachInOrder } from "@modules/platform/primitives"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { partOriginOf, partTitleOf } from "./source-parts.policy"

@Injectable()
/** Gives the later parts of a document longer than a source may be their own sources. */
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
}
