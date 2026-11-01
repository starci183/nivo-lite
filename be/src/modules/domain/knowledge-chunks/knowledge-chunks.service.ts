import { Injectable } from "@nestjs/common"
import { Brackets, In, IsNull, MoreThanOrEqual, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { hybridHit, hybridScore } from "./hybrid-score.policy"
import type {
    ChunkArrangement,
    ChunkBatchWrite,
    ChunkHit,
    ChunkDraft,
    ChunkQuery,
    ChunkWrite,
    EmbeddedChunk,
    ModelInUse,
    PassagePlace,
    PassageView,
    PlaceWrite,
    SourcePassage,
    StaleChunk,
    VectorWrite,
} from "./knowledge-chunks.contracts"
import { passageHashOf } from "./passage-hash.policy"
import { placeOfRow } from "./passage-place.policy"
import { KnowledgeChunkEntity } from "./persistence/entities"

/** The most passages one source lists or reports as embedded. */
const EMBEDDED_LIMIT = 2000
const PASSAGE_LIMIT = 500

/** The most passages one read of several sources answers. */
const SOURCES_PASSAGE_LIMIT = 10_000

/** The vector of each id, picked from the two arrays the write carries. */
const VECTOR_OF_ID =
    '(SELECT t.embedding::extensions.vector FROM unnest(CAST(:ids AS uuid[]), CAST(:vectors AS text[])) AS t(id, embedding) WHERE t.id = "knowledge_chunks"."id")'

/** The hash of each id, picked from the two arrays the write carries. */
const HASH_OF_ID =
    '(SELECT t.hash FROM unnest(CAST(:ids AS uuid[]), CAST(:hashes AS text[])) AS t(id, hash) WHERE t.id = "knowledge_chunks"."id")'

/** The new order of each id, picked from the two arrays the write carries. */
const ORDER_OF_ID =
    '(SELECT t.ord FROM unnest(CAST(:ids AS uuid[]), CAST(:orders AS integer[])) AS t(id, ord) WHERE t.id = "knowledge_chunks"."id")'

/** The place kind of each order, picked from the arrays the write carries. */
const KIND_OF_ORD =
    '(SELECT t.kind FROM unnest(CAST(:orders AS integer[]), CAST(:kinds AS text[]), CAST(:labels AS text[])) AS t(ord, kind, label) WHERE t.ord = "knowledge_chunks"."ord")'

/** The place label of each order, picked from the arrays the write carries. */
const LABEL_OF_ORD =
    '(SELECT t.label FROM unnest(CAST(:orders AS integer[]), CAST(:kinds AS text[]), CAST(:labels AS text[])) AS t(ord, kind, label) WHERE t.ord = "knowledge_chunks"."ord")'

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
    contentHash: draft.vector === null ? null : passageHashOf(draft.text, write.model),
    placeKind: draft.place?.kind ?? null,
    placeLabel: draft.place?.label ?? null,
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

    /**
     * Puts the stored passages in the places of a new text in one transaction: moved passages keep their id and vector, what sat where one
     * lands goes, and so do the passages past the end. Any other passage stays searchable until its order is written.
     */
    async arrange(arrangement: ChunkArrangement): Promise<void> {
        const { workspaceId, sourceId, moves, count } = arrangement
        const ids = moves.map((move) => move.id)
        await this.entityManager.transaction(async (tx) => {
            if (moves.length > 0) {
                await tx.delete(KnowledgeChunkEntity, {
                    sourceId,
                    workspaceId,
                    ord: In(moves.map((move) => move.order)),
                    id: Not(In(ids)),
                })
                await tx
                    .createQueryBuilder(KnowledgeChunkEntity, "kc")
                    .update()
                    .set({ ord: () => ORDER_OF_ID })
                    .where("workspace_id = :workspaceId AND id = ANY(CAST(:ids AS uuid[]))")
                    .setParameters({ workspaceId, ids, orders: moves.map((move) => move.order) })
                    .execute()
            }
            await tx.delete(KnowledgeChunkEntity, { sourceId, workspaceId, ord: MoreThanOrEqual(count) })
        })
    }

    /**
     * Writes where each passage of a source sits in its document, by order, on the stored passages: a passage kept where it was or moved
     * keeps its vector and only learns its place, so nothing is embedded again. An order the write does not name is left as it is.
     */
    async place(write: PlaceWrite): Promise<void> {
        if (write.places.length === 0) return
        await this.entityManager
            .createQueryBuilder(KnowledgeChunkEntity, "kc")
            .update()
            .set({ placeKind: () => KIND_OF_ORD, placeLabel: () => LABEL_OF_ORD })
            .where("workspace_id = :workspaceId AND source_id = :sourceId AND ord = ANY(CAST(:orders AS integer[]))")
            .setParameters({
                workspaceId: write.workspaceId,
                sourceId: write.sourceId,
                orders: write.places.map((one) => one.order),
                kinds: write.places.map((one) => one.place?.kind ?? null),
                labels: write.places.map((one) => one.place?.label ?? null),
            })
            .execute()
    }

    /** The place of each of these passages that has one, by passage id; the caller has proven the workspace. */
    async placesOf(workspaceId: string, passageIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, PassagePlace>> {
        if (passageIds.length === 0) return new Map()
        const rows = await this.entityManager.find(KnowledgeChunkEntity, {
            select: { id: true, placeKind: true, placeLabel: true },
            where: { workspaceId, id: In(passageIds.slice(0, PASSAGE_LIMIT)) },
            take: PASSAGE_LIMIT,
        })
        const places = new Map<string, PassagePlace>()
        for (const row of rows) {
            const place = placeOfRow(row.placeKind, row.placeLabel)
            if (place !== null) places.set(row.id, place)
        }
        return places
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
            .select(["c.id", "c.ord", "c.content", "c.contentHash", "c.embeddingModel"])
            .where("c.sourceId = :sourceId AND c.workspaceId = :workspaceId AND c.embedding IS NOT NULL", {
                sourceId,
                workspaceId,
            })
            .orderBy("c.ord", "ASC")
            .limit(EMBEDDED_LIMIT)
            .getMany()
        return rows.map((row) => ({
            id: row.id,
            order: row.ord,
            text: row.content,
            hash: row.contentHash,
            model: row.embeddingModel,
        }))
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
            .set({ embedding: () => VECTOR_OF_ID, embeddingModel: write.model, contentHash: () => HASH_OF_ID })
            .where("workspace_id = :workspaceId AND id = ANY(CAST(:ids AS uuid[]))")
            .setParameters({
                workspaceId: write.workspaceId,
                ids: [...write.ids],
                vectors: [...write.vectors],
                hashes: [...write.hashes],
            })
            .execute()
    }
}
