import { Injectable } from "@nestjs/common"
import { Brackets } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { hybridHit, hybridScore } from "./hybrid-score.policy"
import type {
    ChunkHit,
    ChunkQuery,
    ChunkWrite,
    EmbeddedChunk,
    PassageView,
    StaleChunk,
    VectorWrite,
} from "./knowledge-chunks.contracts"
import { KnowledgeChunkEntity } from "./persistence/entities"

/** The most passages one source lists or reports as embedded. */
const EMBEDDED_LIMIT = 2000
const PASSAGE_LIMIT = 500

/** The vector of each id, picked from the two arrays the write carries. */
const VECTOR_OF_ID =
    '(SELECT t.embedding::extensions.vector FROM unnest(CAST(:ids AS uuid[]), CAST(:vectors AS text[])) AS t(id, embedding) WHERE t.id = "knowledge_chunks"."id")'

/** The most passages one search answers. */
const SEARCH_MAX = 40

/** A passage row as the search names its columns. */
interface ChunkHitRow {
    readonly id: string
    readonly sourceId: string
    readonly module: string | null
    readonly content: string
    readonly score: number
    readonly visibility: string
    readonly ord: number
}

/** How many passages one insert statement stores. */
const INSERT_BATCH = 50

@Injectable()
/** The passages of a source: stored in place of the earlier ones, and given vectors when the model changes. */
export class KnowledgeChunksService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Replaces the passages of a source with these in one transaction; a passage without a vector is found by keyword only. */
    async replace(write: ChunkWrite): Promise<void> {
        await this.entityManager.transaction(async (tx) => {
            await tx.delete(KnowledgeChunkEntity, { sourceId: write.sourceId, workspaceId: write.workspaceId })
            const starts = Array.from(
                { length: Math.ceil(write.drafts.length / INSERT_BATCH) },
                (_, index) => index * INSERT_BATCH,
            )
            await eachInOrder(starts, (from) => {
                const drafts = write.drafts.slice(from, from + INSERT_BATCH)
                return tx.insert(
                    KnowledgeChunkEntity,
                    drafts.map((draft, offset) => ({
                        workspaceId: write.workspaceId,
                        sourceId: write.sourceId,
                        module: write.module,
                        visibility: write.visibility,
                        installationId: write.installationId,
                        ord: from + offset,
                        content: draft.text,
                        embedding: draft.vector,
                        embeddingModel: draft.vector === null ? null : write.model,
                    })),
                )
            })
        })
    }

    /**
     * The best passages of a workspace for a query, filtered by the lens (module, instance, audience) in SQL: the vector half scores
     * only passages of the query model, the word half every passage; a passage must be close or match a word to count.
     */
    async search(query: ChunkQuery): Promise<ReadonlyArray<ChunkHit>> {
        const terms = { vector: query.vector !== null && query.model !== null, text: query.tsquery !== null }
        if (!terms.vector && !terms.text) return []
        const found = this.entityManager
            .createQueryBuilder(KnowledgeChunkEntity, "c")
            .select("c.id", "id")
            .addSelect("c.sourceId", "sourceId")
            .addSelect("c.module", "module")
            .addSelect("c.content", "content")
            .addSelect(hybridScore("c", terms), "score")
            .addSelect("c.visibility", "visibility")
            .addSelect("c.ord", "ord")
            .where({ workspaceId: query.workspaceId })
            .andWhere(
                new Brackets((own) =>
                    own.where("c.module IS NULL").orWhere("c.module = :module", { module: query.module }),
                ),
            )
            .andWhere(
                new Brackets((own) =>
                    own
                        .where("c.installationId IS NULL")
                        .orWhere("c.installationId = :installationId", { installationId: query.installationId }),
                ),
            )
            .andWhere(hybridHit("c", terms))
            .setParameters({ vector: query.vector, model: query.model, tsquery: query.tsquery })
        const rows = await (query.audience === "customer" ? found.andWhere({ visibility: "public" }) : found)
            .orderBy("score", "DESC")
            .limit(Math.max(1, Math.min(query.limit, SEARCH_MAX)))
            .getRawMany<ChunkHitRow>()
        return rows.map((row) => ({
            id: row.id,
            sourceId: row.sourceId,
            module: row.module,
            content: row.content,
            score: row.score,
            visibility: row.visibility,
            order: row.ord,
        }))
    }

    /** The stored passages of a source in order, for the Knowledge page; the caller has proven the workspace. */
    async passagesOf(workspaceId: string, sourceId: string): Promise<ReadonlyArray<PassageView>> {
        const rows = await this.entityManager
            .createQueryBuilder(KnowledgeChunkEntity, "c")
            .select("c.id", "id")
            .addSelect("c.ord", "ord")
            .addSelect("c.content", "content")
            .addSelect("(c.embedding IS NOT NULL)", "hasEmbedding")
            .where("c.workspaceId = :workspaceId AND c.sourceId = :sourceId", { workspaceId, sourceId })
            .orderBy("c.ord", "ASC")
            .limit(PASSAGE_LIMIT)
            .getRawMany<{ id: string; ord: number; content: string; hasEmbedding: boolean }>()
        return rows.map((row) => ({
            id: row.id,
            order: row.ord,
            content: row.content,
            hasEmbedding: row.hasEmbedding,
        }))
    }

    /** The stored passages of a source that have a vector, in order. */
    async embeddedOf(workspaceId: string, sourceId: string): Promise<ReadonlyArray<EmbeddedChunk>> {
        const rows = await this.entityManager
            .createQueryBuilder(KnowledgeChunkEntity, "c")
            .select(["c.ord", "c.content", "c.embeddingModel"])
            .where("c.sourceId = :sourceId AND c.workspaceId = :workspaceId AND c.embedding IS NOT NULL", {
                sourceId,
                workspaceId,
            })
            .orderBy("c.ord", "ASC")
            .limit(EMBEDDED_LIMIT)
            .getMany()
        return rows.map((row) => ({ order: row.ord, text: row.content, model: row.embeddingModel }))
    }

    /** Up to `limit` passages of a workspace that have no vector, or one made by another model than `model`. */
    async stale(workspaceId: string, model: string, limit: number): Promise<ReadonlyArray<StaleChunk>> {
        const rows = await this.entityManager
            .createQueryBuilder(KnowledgeChunkEntity, "c")
            .select(["c.id", "c.content"])
            .where(
                "c.workspaceId = :workspaceId AND (c.embedding IS NULL OR c.embeddingModel IS NULL OR c.embeddingModel <> :model)",
                { workspaceId, model },
            )
            .orderBy("c.createdAt", "ASC")
            .limit(limit)
            .getMany()
        return rows.map((row) => ({ id: row.id, text: row.content }))
    }

    /** Gives passages their vectors. */
    async setVectors(write: VectorWrite): Promise<void> {
        await this.entityManager
            .createQueryBuilder(KnowledgeChunkEntity, "kc")
            .update()
            .set({ embedding: () => VECTOR_OF_ID, embeddingModel: write.model })
            .where("workspace_id = :workspaceId AND id = ANY(CAST(:ids AS uuid[]))")
            .setParameters({ workspaceId: write.workspaceId, ids: [...write.ids], vectors: [...write.vectors] })
            .execute()
    }
}
