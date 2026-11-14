import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import type { AcceptedRow, VectorRow, VectorRowCursor, VectorRowSource, WantedRow } from "@modules/integrations/qdrant"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { passageTextHashOf } from "./passage-hash.policy"
import { KnowledgeChunkEntity } from "./persistence/entities"
import { storedVectorOf } from "./vector.policy"

/** The most rows one read answers. */
const READ_MAX = 500

/** The most passages one document's read answers: a document holds at most 120,000 characters, a few hundred passages. */
const SOURCE_MAX = 2000

/** One line of the read of the vectors Postgres still holds. */
interface StoredLine {
    /** The passage. */
    readonly id: string
    /** Its vector as the database answers it. */
    readonly embedding: unknown
}

/** A passage as the vector sync reads it: every passage wants a point, and it is always in force. */
const rowOf = (passage: KnowledgeChunkEntity): VectorRow => ({
    id: passage.id,
    workspaceId: passage.workspaceId,
    wanted: true,
    text: passage.content,
    textHash: passage.textHash ?? passageTextHashOf(passage.content),
    mirror: {
        workspaceId: passage.workspaceId,
        sourceId: passage.sourceId,
        module: passage.module,
        installationId: passage.installationId,
        isPublic: passage.visibility === "public",
        customerReady: passage.customerReady,
        inForce: true,
    },
    stamped: passage.indexedAt !== null,
    stampedModel: passage.embeddingModel,
})

@Injectable()
/**
 * The Postgres side of the passages' points: the rows the vector sync compares with the index, and the one write it makes back
 * (`indexed_at`: the index accepted the passage's vector, so the passage is found by meaning from then on). One point per passage
 * row, the point id is the row id. Nothing here writes a vector to Postgres.
 */
export class PassageVectorRowsService implements VectorRowSource {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The passages of one workspace with these ids. */
    async byIds(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<VectorRow>> {
        const unique = [...new Set(ids)].slice(0, READ_MAX)
        if (unique.length === 0) return []
        const rows = await this.entityManager.find(KnowledgeChunkEntity, {
            where: { workspaceId, id: In(unique) },
            take: unique.length,
        })
        return rows.map((row) => rowOf(row))
    }

    /** Every passage of one document, in reading order (the index on `(source_id, ord)`). */
    async ofSource(workspaceId: string, sourceId: string): Promise<ReadonlyArray<VectorRow>> {
        const rows = await this.entityManager.find(KnowledgeChunkEntity, {
            where: { workspaceId, sourceId },
            order: { ord: "ASC" },
            take: SOURCE_MAX,
        })
        return rows.map((row) => rowOf(row))
    }

    /** One page of every passage, whatever workspace, in id order after `afterId` (the primary key). */
    async page(afterId: VectorRowCursor, limit: number): Promise<ReadonlyArray<VectorRow>> {
        const query = this.entityManager.createQueryBuilder(KnowledgeChunkEntity, "c")
        if (afterId !== null) query.where("c.id > :afterId", { afterId })
        const rows = await query
            .orderBy("c.id", "ASC")
            .limit(Math.max(1, Math.min(limit, READ_MAX)))
            .getMany()
        return rows.map((row) => rowOf(row))
    }

    /** Among these ids, the passages that exist (every passage wants a point), whatever workspace. */
    async wantedAmong(ids: ReadonlyArray<string>): Promise<ReadonlyArray<WantedRow>> {
        const unique = [...new Set(ids)].slice(0, READ_MAX)
        if (unique.length === 0) return []
        const rows = await this.entityManager.find(KnowledgeChunkEntity, {
            select: { id: true, workspaceId: true },
            where: { id: In(unique) },
            take: unique.length,
        })
        return rows.map((row) => ({ id: row.id, workspaceId: row.workspaceId }))
    }

    /**
     * The vectors the pgvector column still holds for these passages under this identity (the transition): a point is copied from
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
            .createQueryBuilder(KnowledgeChunkEntity, "c")
            .select("c.id", "id")
            .addSelect("c.embedding", "embedding")
            .where("c.workspaceId = :workspaceId AND c.id IN (:...ids) AND c.embedding IS NOT NULL AND c.embeddingModel = :model", {
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

    /** Passages adopt nothing: an unchanged passage keeps its row (and so its point) across a re-upload, by hash, when it is indexed. */
    donors(): Promise<ReadonlyMap<string, string>> {
        return Promise.resolve(new Map())
    }

    /**
     * Records that the index accepted the vectors of these passages under this identity: `indexed_at` and the identity. A vector of
     * ANOTHER identity the pgvector column may still hold is cleared in the same write, so the column never carries a vector under a
     * label that did not make it.
     */
    async stamp(workspaceId: string, accepted: ReadonlyArray<AcceptedRow>, model: string): Promise<void> {
        if (accepted.length === 0) return
        await this.entityManager
            .createQueryBuilder(KnowledgeChunkEntity, "kc")
            .update()
            .set({
                embedding: () => "CASE WHEN embedding_model = :model THEN embedding ELSE NULL END",
                embeddingModel: model,
                indexedAt: () => "now()",
            })
            .where("workspace_id = :workspaceId AND id = ANY(CAST(:ids AS uuid[]))")
            .setParameters({ workspaceId, model, ids: accepted.map((row) => row.id) })
            .execute()
    }
}
