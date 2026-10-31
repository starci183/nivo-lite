import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { DossierDocumentCount, SourceCategory } from "./knowledge-sources.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"

/** The most categories or dossier references one read answers. */
const GROUP_MAX = 500

/** The dossier reference of a document: the number of its dossier:<n> tag, else the number a title starts with before a dot and a space ("08. Report" is 8), without leading zeros. */
const REF_EXPRESSION = String.raw`COALESCE((SELECT substring(t FROM '^dossier:0*([0-9]+)$') FROM unnest(s.tags) AS t WHERE substring(t FROM '^dossier:0*([0-9]+)$') IS NOT NULL LIMIT 1), substring(s.title FROM '^\s*0*([0-9]+)\.\s'))`

/** The number of the top folder of a document, from its folder:<n> tag; null for a document without one. */
const FOLDER_EXPRESSION = String.raw`(SELECT CAST(substring(t FROM '^folder:([0-9]{1,4})$') AS integer) FROM unnest(s.tags) AS t WHERE substring(t FROM '^folder:([0-9]{1,4})$') IS NOT NULL LIMIT 1)`

const isCategoryRow = (row: unknown): row is { topic: string; documents: string; bytes: string; folder: unknown } =>
    typeof row === "object" &&
    row !== null &&
    "topic" in row &&
    typeof row.topic === "string" &&
    "documents" in row &&
    "bytes" in row &&
    "folder" in row

const isCountRow = (row: unknown): row is { topic: string; ref: string; documents: string } =>
    typeof row === "object" &&
    row !== null &&
    "topic" in row &&
    typeof row.topic === "string" &&
    "ref" in row &&
    typeof row.ref === "string" &&
    "documents" in row

@Injectable()
/** The grouped reads of the documents of a workspace: what each category holds, and how many documents name each dossier. */
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

    /** How many documents of each category name each dossier reference; documents that name none are left out. Any member may read it. */
    async dossierCounts(userId: string, workspaceId: string): Promise<ReadonlyArray<DossierDocumentCount>> {
        await this.members.require(userId, workspaceId)
        const rows: ReadonlyArray<unknown> = await this.entityManager
            .createQueryBuilder(KnowledgeSourceEntity, "s")
            .select("s.topic", "topic")
            .addSelect(REF_EXPRESSION, "ref")
            .addSelect("COUNT(*)", "documents")
            .where(`s.workspaceId = :workspaceId AND s.topic IS NOT NULL AND ${REF_EXPRESSION} IS NOT NULL`, {
                workspaceId,
            })
            .groupBy("s.topic")
            .addGroupBy("ref")
            .limit(GROUP_MAX)
            .getRawMany()
        return rows
            .filter(isCountRow)
            .map((row) => ({ topic: row.topic, ref: row.ref, documentCount: Number(row.documents) }))
    }
}
