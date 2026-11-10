import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { toVector } from "@modules/domain/knowledge-chunks"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { FactRecord } from "./brain-facts.contracts"
import { toFactRecord } from "./fact-record.mapper"
import type { EmbeddingIdentity, StoredEmbedding } from "./embedding-standard.policy"
import { BrainFactEntity } from "./persistence/entities"

/** The most rows one embedding read answers. */
const EMBED_READ_MAX = 500

/** A fact in force with what its stored vector says. */
export interface FactEmbeddingState {
    /** The fact. */
    readonly fact: FactRecord
    /** Its stored vector's identity and hash. */
    readonly stored: StoredEmbedding
}

/** A fact a vector search found, with its cosine distance to the question. */
export interface NearFact {
    /** The fact. */
    readonly fact: FactRecord
    /** The cosine distance, 0 = same direction. */
    readonly distance: number
}

@Injectable()
/**
 * The vectors of the truth graph's facts, under the embedding standard: a vector is stored with its identity and the hash of its text,
 * a search compares only one identity, and the rows of another identity are found for a re-index. Every read names the workspace.
 */
export class BrainFactEmbeddingsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The facts in force of the workspace with what their stored vectors say, oldest change first. */
    async inForce(workspaceId: string, limit: number): Promise<ReadonlyArray<FactEmbeddingState>> {
        const rows = await this.entityManager.find(BrainFactEntity, {
            where: { workspaceId, status: "active" },
            order: { updatedAt: "ASC", id: "ASC" },
            take: Math.min(limit, EMBED_READ_MAX),
        })
        return rows.map((row) => ({
            fact: toFactRecord(row),
            stored: {
                model: row.embeddingModel ?? null,
                dimensions: row.embeddingDimensions ?? null,
                hash: row.embeddingHash ?? null,
            },
        }))
    }

    /**
     * The facts whose vector was made by another identity than this one (another profile or other dimensions): what a re-index job
     * embeds again. One read on `brain_facts_embedding_model (workspace_id, embedding_model)`.
     */
    async ofOtherIdentity(
        workspaceId: string,
        identity: EmbeddingIdentity,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        const rows = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .where(
                "f.workspaceId = :workspaceId AND f.embeddingModel IS NOT NULL AND (f.embeddingModel <> :model OR f.embeddingDimensions <> :dimensions)",
                { workspaceId, model: identity.model, dimensions: identity.dimensions },
            )
            .orderBy("f.id", "ASC")
            .limit(Math.min(limit, EMBED_READ_MAX))
            .getMany()
        return rows.map(toFactRecord)
    }

    /** Stores the vector of one fact in force, with the identity it was made by and the hash of the text it was made from. */
    async store(
        workspaceId: string,
        id: string,
        vector: ReadonlyArray<number>,
        identity: EmbeddingIdentity,
        hash: string,
    ): Promise<void> {
        await this.entityManager
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set({
                embedding: () => "CAST(:vector AS extensions.vector)",
                embeddingModel: identity.model,
                embeddingHash: hash,
            })
            .where({ workspaceId, id, status: "active" })
            .setParameter("vector", toVector(vector))
            .execute()
    }

    /**
     * The facts in force nearest to a question's vector, made by the SAME identity only (profile and dimensions): a vector of another
     * identity is never compared, whatever its size.
     */
    async nearest(
        workspaceId: string,
        identity: EmbeddingIdentity,
        vector: ReadonlyArray<number>,
        limit: number,
    ): Promise<ReadonlyArray<NearFact>> {
        if (vector.length !== identity.dimensions) return []
        const distance = "(f.embedding OPERATOR(extensions.<=>) CAST(:vector AS extensions.vector))"
        const ranked: ReadonlyArray<unknown> = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .select("f.id", "id")
            .addSelect(distance, "distance")
            .where(
                "f.workspaceId = :workspaceId AND f.status = 'active' AND f.embedding IS NOT NULL AND f.embeddingModel = :model AND f.embeddingDimensions = :dimensions",
                { workspaceId, model: identity.model, dimensions: identity.dimensions, vector: toVector(vector) },
            )
            .orderBy("distance", "ASC")
            .limit(Math.min(limit, 50))
            .getRawMany()
        const hits = ranked.flatMap((line) => {
            if (typeof line !== "object" || line === null) return []
            const id: unknown = Reflect.get(line, "id")
            const away: unknown = Reflect.get(line, "distance")
            return typeof id === "string" ? [{ id, distance: Number(away ?? 1) }] : []
        })
        if (hits.length === 0) return []
        const rows = await this.entityManager.find(BrainFactEntity, {
            where: { workspaceId, id: In(hits.map((hit) => hit.id)) },
            take: hits.length,
        })
        const byId = new Map(rows.map((row) => [row.id, toFactRecord(row)]))
        return hits.flatMap((hit) => {
            const fact = byId.get(hit.id)
            return fact === undefined ? [] : [{ fact, distance: hit.distance }]
        })
    }
}
