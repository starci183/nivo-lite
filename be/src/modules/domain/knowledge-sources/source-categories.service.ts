import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { SourceCategory } from "./knowledge-sources.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"

/** The most categories one read answers. */
const GROUP_MAX = 500

/** The number of the top folder of a document, from its folder:<n> tag; null for a document without one. */
const FOLDER_EXPRESSION = `(SELECT CAST(substring(t FROM '^folder:([0-9]{1,4})$') AS integer) FROM unnest(s.tags) AS t WHERE substring(t FROM '^folder:([0-9]{1,4})$') IS NOT NULL LIMIT 1)`

const isCategoryRow = (row: unknown): row is { topic: string; documents: string; bytes: string; folder: unknown } =>
    typeof row === "object" &&
    row !== null &&
    "topic" in row &&
    typeof row.topic === "string" &&
    "documents" in row &&
    "bytes" in row &&
    "folder" in row

@Injectable()
/** The grouped reads of the documents of a workspace: what each category holds. */
export class SourceCategoriesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The categories (topics) of the workspace with their document count and raw bytes, by name; any member may read them. */
    async categories(userId: string, workspaceId: string): Promise<ReadonlyArray<SourceCategory>> {
        await this.members.require(userId, workspaceId)
        const rows: ReadonlyArray<unknown> = await this.entityManager
            .createQueryBuilder(KnowledgeSourceEntity, "s")
            .select("s.topic", "topic")
            .addSelect("COUNT(*)", "documents")
            .addSelect("COALESCE(SUM(s.sizeBytes), 0)", "bytes")
            .addSelect(`MIN(${FOLDER_EXPRESSION})`, "folder")
            .where("s.workspaceId = :workspaceId AND s.topic IS NOT NULL", { workspaceId })
            .groupBy("s.topic")
            .orderBy("s.topic")
            .limit(GROUP_MAX)
            .getRawMany()
        return rows.filter(isCategoryRow).map((row) => ({
            topic: row.topic,
            order: row.folder === null ? null : Number(row.folder),
            documentCount: Number(row.documents),
            sizeBytes: Number(row.bytes),
        }))
    }
}
