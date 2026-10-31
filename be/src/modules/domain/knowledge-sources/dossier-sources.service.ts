import { Injectable } from "@nestjs/common"
import { ArrayContains, In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DOSSIER_SOURCES_MAX } from "./dossier-sources.contracts"
import type { DossierSource, MaybeDossierSource } from "./dossier-sources.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"

/** The columns the review reads: everything but the text. */
const COLUMNS = {
    id: true,
    title: true,
    topic: true,
    tags: true,
    origin: true,
    kind: true,
    status: true,
    chunkCount: true,
    sizeBytes: true,
    updatedAt: true,
    createdAt: true,
} as const

const toDossierSource = (row: KnowledgeSourceEntity): DossierSource => ({
    id: row.id,
    title: row.title,
    topic: row.topic,
    tags: [...row.tags],
    origin: row.origin,
    kind: row.kind,
    status: row.status,
    chunkCount: row.chunkCount,
    sizeBytes: row.sizeBytes,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
})

@Injectable()
/** The documents of a workspace as the dossier review reads them: by the categories they file under, by one tag, or one by id. The caller has proven the workspace. */
export class DossierSourcesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The documents of these categories (topics), oldest first, at most `limit` and never more than the read bound. */
    async sourcesOfTopics(
        workspaceId: string,
        topics: ReadonlyArray<string>,
        limit: number,
    ): Promise<ReadonlyArray<DossierSource>> {
        if (topics.length === 0) return []
        const rows = await this.entityManager.find(KnowledgeSourceEntity, {
            select: COLUMNS,
            where: { workspaceId, topic: In([...topics]) },
            order: { createdAt: "ASC", id: "ASC" },
            take: Math.min(limit, DOSSIER_SOURCES_MAX),
        })
        return rows.map(toDossierSource)
    }

    /** The first document carrying this tag, or null. */
    async byTag(workspaceId: string, tag: string): Promise<MaybeDossierSource> {
        const row = await this.entityManager.findOne(KnowledgeSourceEntity, {
            select: COLUMNS,
            where: { workspaceId, tags: ArrayContains([tag]) },
            order: { createdAt: "ASC" },
        })
        return row === null ? null : toDossierSource(row)
    }

    /** One document of the workspace, or null. */
    async sourceOf(workspaceId: string, sourceId: string): Promise<MaybeDossierSource> {
        const row = await this.entityManager.findOne(KnowledgeSourceEntity, {
            select: COLUMNS,
            where: { workspaceId, id: sourceId },
        })
        return row === null ? null : toDossierSource(row)
    }
}
