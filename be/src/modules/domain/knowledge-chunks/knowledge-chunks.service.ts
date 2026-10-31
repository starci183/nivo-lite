import { Injectable } from "@nestjs/common"
import { Brackets, In, IsNull, MoreThanOrEqual, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { hybridHit, hybridScore } from "./hybrid-score.policy"
import type {
    ChunkBatchWrite,
    ChunkHit,
    ChunkDraft,
    ChunkQuery,
    ChunkWrite,
    EmbeddedChunk,
    ModelInUse,
    PassageView,
    SourcePassage,
    StaleChunk,
    VectorWrite,
} from "./knowledge-chunks.contracts"
import { KnowledgeChunkEntity } from "./persistence/entities"

/** The most passages one source lists or reports as embedded. */
const EMBEDDED_LIMIT = 2000
const PASSAGE_LIMIT = 500

/** The most passages one read of several sources answers. */
const SOURCES_PASSAGE_LIMIT = 10_000

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

/** The row of a passage at its order, with the vector it was given. */
const rowOf = (write: Omit<ChunkWrite, "drafts">, draft: ChunkDraft, order: number) => ({
    workspaceId: write.workspaceId,
    sourceId: write.sourceId,
    module: write.module,
    visibility: write.visibility,
    installationId: write.installationId,
    ord: order,
    content: draft.text,
    embedding: draft.vector,
    embeddingModel: draft.vector === null ? null : write.model,
})

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
                    drafts.map((draft, offset) => rowOf(write, draft, from + offset)),
                )
            })
        })
    }

    /** Stores these passages in place of the passages at the same orders in one transaction; the passages of other orders stay, so a retry keeps what is already stored. */
    async keep(write: ChunkBatchWrite): Promise<void> {
        if (write.drafts.length === 0) return
        await this.entityManager.transaction(async (tx) => {
            await tx.delete(KnowledgeChunkEntity, {
                sourceId: write.sourceId,
                workspaceId: write.workspaceId,
                ord: In(write.drafts.map((draft) => draft.order)),
            })
            await tx.insert(
                KnowledgeChunkEntity,
                write.drafts.map((draft) => rowOf(write, draft, draft.order)),
            )
        })
    }

    /** Removes the passages of a source from this order on (the text got shorter). */
    async trim(workspaceId: string, sourceId: string, count: number): Promise<void> {
        await this.entityManager.delete(KnowledgeChunkEntity, { sourceId, workspaceId, ord: MoreThanOrEqual(count) })
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

    /** The first `perSource` passages of each of these sources in one bounded read, ordered by source then order; the caller has proven the workspace. */
    async passagesOfSources(
        workspaceId: string,
        sourceIds: ReadonlyArray<string>,
        perSource: number,
    ): Promise<ReadonlyArray<SourcePassage>> {
        if (sourceIds.length === 0) return []
        const rows = await this.entityManager
            .createQueryBuilder(KnowledgeChunkEntity, "c")
            .select(["c.id", "c.sourceId", "c.ord", "c.content"])
            .where("c.workspaceId = :workspaceId AND c.sourceId IN (:...sourceIds) AND c.ord < :perSource", {
                workspaceId,
                sourceIds: [...sourceIds],
                perSource,
            })
            .orderBy("c.sourceId", "ASC")
            .addOrderBy("c.ord", "ASC")
            .limit(Math.min(sourceIds.length * perSource, SOURCES_PASSAGE_LIMIT))
            .getMany()
        return rows.map((row) => ({ id: row.id, sourceId: row.sourceId, order: row.ord, text: row.content }))
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

    /** Whether a source has passages and every one has a vector of `model`; with a null `model` (no embeddings here) passages are enough. */
    async holds(workspaceId: string, sourceId: string, model: ModelInUse): Promise<boolean> {
        const own = { workspaceId, sourceId }
        if (!(await this.entityManager.exists(KnowledgeChunkEntity, { where: own }))) return false
        if (model === null) return true
        const stale = await this.entityManager.exists(KnowledgeChunkEntity, {
            where: [
                { ...own, embeddingModel: IsNull() },
                { ...own, embeddingModel: Not(model) },
            ],
        })
        return !stale
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
