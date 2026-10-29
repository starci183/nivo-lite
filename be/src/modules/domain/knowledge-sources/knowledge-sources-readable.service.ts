import { Injectable } from "@nestjs/common"
import { Brackets, In } from "typeorm"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { DocumentVisibility, ReadableScope, ReadableSource } from "./knowledge-sources.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"
import type { ReadableSourceProjection } from "./persistence/knowledge-source.projection"

@Injectable()
/** What an agent's view may read of the indexed documents of its workspace: the documents with their text, and how many there are. */
export class KnowledgeSourcesReadableService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The indexed documents an agent's view may read, oldest first; a customer view gets public documents only. */
    async readableFor(scope: ReadableScope, limit: number): Promise<ReadonlyArray<ReadableSource>> {
        const rows = await this.readable(scope)
            .select("ks.id", "id")
            .addSelect("ks.title", "title")
            .addSelect("ks.topic", "topic")
            .addSelect("ks.kind", "kind")
            .addSelect("ks.visibility", "visibility")
            .addSelect("ks.content", "content")
            .addSelect("ks.module", "module")
            .addSelect("ks.installationId", "installationId")
            .addSelect("ks.updated_at::text", "updatedAt")
            .orderBy("ks.createdAt", "ASC")
            .limit(limit)
            .getRawMany<ReadableSourceProjection>()
        return rows
            .filter(
                (row) =>
                    (row.module === null || row.module === scope.module) &&
                    (row.installationId === null || row.installationId === scope.installationId) &&
                    (scope.audience === "internal" || row.visibility === "public"),
            )
            .map((row) => ({
                id: row.id,
                title: row.title,
                topic: row.topic,
                kind: row.kind,
                visibility: row.visibility === "public" ? "public" : "internal",
                updatedAt: row.updatedAt,
                content: row.content ?? "",
            }))
    }

    /** How many indexed documents of one visibility an agent's view may read; a customer view never counts internal ones. */
    countReadable(scope: ReadableScope, visibility: DocumentVisibility): Promise<number> {
        if (scope.audience === "customer" && visibility === "internal") return Promise.resolve(0)
        return this.readable(scope).andWhere({ visibility }).getCount()
    }

    /** The indexed documents of the workspace that the view of the scope may read: its module or every module, its instance or every instance. */
    private readable(scope: ReadableScope): SelectQueryBuilder<KnowledgeSourceEntity> {
        const query = this.entityManager
            .createQueryBuilder(KnowledgeSourceEntity, "ks")
            .where({ workspaceId: scope.workspaceId, status: In(["ready", "extracting_facts"]) })
            .andWhere(
                new Brackets((own) =>
                    own.where("ks.module IS NULL").orWhere("ks.module = :module", { module: scope.module }),
                ),
            )
            .andWhere(
                new Brackets((own) =>
                    own
                        .where("ks.installationId IS NULL")
                        .orWhere("ks.installationId = :installationId", { installationId: scope.installationId }),
                ),
            )
        return scope.audience === "internal" ? query : query.andWhere({ visibility: "public" })
    }
}
