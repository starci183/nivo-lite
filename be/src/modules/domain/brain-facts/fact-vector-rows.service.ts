import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { storedVectorOf } from "@modules/domain/knowledge-chunks"
import type { AcceptedRow, VectorRow, VectorRowCursor, VectorRowSource, WantedRow } from "@modules/integrations/qdrant"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { factEmbedHashOf, factEmbedTextOf } from "./embedding-standard.policy"
import { toFactRecord } from "./fact-record.mapper"
import { BrainFactEntity } from "./persistence/entities"

/** The most rows one read answers. */
const READ_MAX = 500

/**
 * The statuses whose rows hold a point: truths in force, truths decided for a later start (`scheduled`: Round W, D-W-2: a dated window
 * that waits for its start held no point, so the same window stated again by another document was never compared with it and both
 * were scheduled) and proposals. The last two are only looked up as "the same truth in other words"; a search reads `in_force` points.
 */
const WANTED: ReadonlySet<string> = new Set(["active", "scheduled", "proposed"])

/** The hash of each id, picked from the two arrays one write carries. */
const HASH_OF_ID =
    '(SELECT t.hash FROM unnest(CAST(:ids AS uuid[]), CAST(:hashes AS text[])) AS t(id, hash) WHERE t.id = "brain_facts"."id")'

/** One line of the read of the vectors Postgres still holds. */
interface StoredLine {
    /** The truth. */
    readonly id: string
    /** Its vector as the database answers it. */
    readonly embedding: unknown
}

/** One line of the read of the rows another row may adopt a vector from. */
interface DonorLine {
    /** The row whose point holds the vector. */
    readonly id: string
    /** The hash of its line. */
    readonly hash: string
}

/**
 * A truth as the vector sync reads it. It wants a point while it is in force, scheduled or waiting; any other row (superseded,
 * retired, expired, rejected) holds none. Its flags: public = a public reach; customer-ready = in force AND public; in force =
 * active (a scheduled truth's point is never `in_force`: no search serves it before its start). A restricted truth's modules are not mirrored: the search reads the rows back from Postgres in the reader's lens.
 */
const rowOf = (row: BrainFactEntity): VectorRow => {
    const fact = toFactRecord(row)
    const textHash = factEmbedHashOf(fact)
    const inForce = row.status === "active"
    const isPublic = row.scope === "public"
    return {
        id: row.id,
        workspaceId: row.workspaceId,
        wanted: WANTED.has(row.status),
        text: factEmbedTextOf(fact),
        textHash,
        mirror: {
            workspaceId: row.workspaceId,
            sourceId: null,
            module: null,
            installationId: row.installationId,
            isPublic,
            customerReady: inForce && isPublic,
            inForce,
        },
        stamped: row.embeddingModel != null && row.embeddingHash === textHash,
        stampedModel: row.embeddingModel ?? null,
    }
}

@Injectable()
/**
 * The Postgres side of the truths' points: the rows the vector sync compares with the index, and the one write it makes back (the
 * identity, the hash of the line and `indexed_at`: the index accepted the truth's vector). One point per fact row, the point id is
 * the row id; a new value, label or reach is a new row and so a new point. Nothing here writes a vector to Postgres.
 */
export class FactVectorRowsService implements VectorRowSource {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The truths of one workspace with these ids. */
    async byIds(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<VectorRow>> {
        const unique = [...new Set(ids)].slice(0, READ_MAX)
        if (unique.length === 0) return []
        const rows = await this.entityManager.find(BrainFactEntity, {
            where: { workspaceId, id: In(unique) },
            take: unique.length,
        })
        return rows.map((row) => rowOf(row))
    }

    /** Truths belong to no document. */
    ofSource(): Promise<ReadonlyArray<VectorRow>> {
        return Promise.resolve([])
    }

    /** One page of every fact row, whatever workspace or status, in id order after `afterId` (the primary key). */
    async page(afterId: VectorRowCursor, limit: number): Promise<ReadonlyArray<VectorRow>> {
        const query = this.entityManager.createQueryBuilder(BrainFactEntity, "f")
        if (afterId !== null) query.where("f.id > :afterId", { afterId })
        const rows = await query
            .orderBy("f.id", "ASC")
            .limit(Math.max(1, Math.min(limit, READ_MAX)))
            .getMany()
        return rows.map((row) => rowOf(row))
    }

    /** Among these ids, the truths that exist and are in force, scheduled or waiting, whatever workspace. */
    async wantedAmong(ids: ReadonlyArray<string>): Promise<ReadonlyArray<WantedRow>> {
        const unique = [...new Set(ids)].slice(0, READ_MAX)
        if (unique.length === 0) return []
        const rows = await this.entityManager.find(BrainFactEntity, {
            select: { id: true, workspaceId: true },
            where: { id: In(unique), status: In([...WANTED]) },
            take: unique.length,
        })
        return rows.map((row) => ({ id: row.id, workspaceId: row.workspaceId }))
    }

    /**
     * The vectors the pgvector column still holds for these truths under this identity (the transition): a point is copied from
     * them with no embedding call. This read goes with the column: the contract migration that drops it removes this body.
     */
    async storedVectors(
        workspaceId: string,
        ids: ReadonlyArray<string>,
        model: string,
    ): Promise<ReadonlyMap<string, ReadonlyArray<number>>> {
        const unique = [...new Set(ids)].slice(0, READ_MAX)
        if (unique.length === 0) return new Map()
        const lines = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .select("f.id", "id")
            .addSelect("f.embedding", "embedding")
            .where("f.workspaceId = :workspaceId AND f.id IN (:...ids) AND f.embedding IS NOT NULL AND f.embeddingModel = :model", {
                workspaceId,
                ids: unique,
                model,
            })
            .limit(unique.length)
            .getRawMany<StoredLine>()
        return new Map(
            lines.flatMap((line): ReadonlyArray<readonly [string, ReadonlyArray<number>]> => {
                const vector = storedVectorOf(line.embedding)
                return vector === null ? [] : [[line.id, vector]]
            }),
        )
    }

    /**
     * For each of these line hashes, another row of the workspace whose point the index accepted for the SAME line under this
     * identity (a version that keeps its value, a proposal of a line already known): its vector is adopted with no embedding call.
     * One statement, on `brain_facts_indexed_hash (workspace_id, embedding_hash) WHERE indexed_at IS NOT NULL`.
     */
    async donors(
        workspaceId: string,
        hashes: ReadonlyArray<string>,
        model: string,
        exceptIds: ReadonlyArray<string>,
    ): Promise<ReadonlyMap<string, string>> {
        const wanted = [...new Set(hashes)].slice(0, READ_MAX)
        if (wanted.length === 0) return new Map()
        const lines = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .select("f.id", "id")
            .addSelect("f.embeddingHash", "hash")
            .where(
                "f.workspaceId = :workspaceId AND f.embeddingHash IN (:...hashes) AND f.indexedAt IS NOT NULL AND f.embeddingModel = :model AND f.status IN (:...statuses)",
                { workspaceId, hashes: wanted, model, statuses: [...WANTED] },
            )
            .orderBy("f.id", "ASC")
            .limit(READ_MAX)
            .getRawMany<DonorLine>()
        const except = new Set(exceptIds)
        const donors = new Map<string, string>()
        for (const line of lines) if (!except.has(line.id) && !donors.has(line.hash)) donors.set(line.hash, line.id)
        return donors
    }

    /**
     * Records that the index accepted the vectors of these truths under this identity: the identity, the hash of each line and
     * `indexed_at`. A vector of ANOTHER identity the pgvector column may still hold is cleared in the same write.
     */
    async stamp(workspaceId: string, accepted: ReadonlyArray<AcceptedRow>, model: string): Promise<void> {
        if (accepted.length === 0) return
        await this.entityManager
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set({
                embedding: () => "CASE WHEN embedding_model = :model THEN embedding ELSE NULL END",
                embeddingModel: model,
                embeddingHash: () => HASH_OF_ID,
                indexedAt: () => "now()",
            })
            .where("workspace_id = :workspaceId AND id = ANY(CAST(:ids AS uuid[]))")
            .setParameters({
                workspaceId,
                model,
                ids: accepted.map((row) => row.id),
                hashes: accepted.map((row) => row.textHash),
            })
            .execute()
    }
}
