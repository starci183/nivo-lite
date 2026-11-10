import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { toVector } from "@modules/domain/knowledge-chunks"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { FactAudience, FactRecord, InstallationScope } from "./brain-facts.contracts"
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

/** The statuses whose rows may hold a vector: facts in force, and proposals embedded when they are filed (to find the same fact in other words). */
export type EmbeddedStatus = "active" | "proposed"

/** Whose view a vector search of facts answers for: the same lens as the word search (`visibleTo`), applied in SQL before the limit. */
export interface FactLens {
    /** `customer` reads public facts only. */
    readonly audience: FactAudience
    /** The module of the caller: an internal caller reads the restricted facts of its module. */
    readonly module: string
    /** The instance of the caller: it reads the shared facts and its own; null = the shared ones only. */
    readonly installationId: InstallationScope
}

/** What a search for the facts nearest to one stored fact looks at. */
export interface NearToOptions {
    /** The statuses of the facts compared with it. */
    readonly statuses: ReadonlyArray<EmbeddedStatus>
    /** Only facts of this instance scope (the same scope as the fact: null = the shared ones). */
    readonly installationId: InstallationScope
    /** Only facts at a cosine distance below this. */
    readonly maxDistance: number
    /** At most this many, nearest first. */
    readonly limit: number
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

    /** The facts of the workspace with these ids with what their stored vectors say, in no order. */
    async statesOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<FactEmbeddingState>> {
        const unique = [...new Set(ids)].slice(0, EMBED_READ_MAX)
        if (unique.length === 0) return []
        const rows = await this.entityManager.find(BrainFactEntity, { where: { workspaceId, id: In(unique) }, take: unique.length })
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
     * Stores the vector of one fact in force or waiting (a proposal is embedded when it is filed, so the same fact in other words is
     * found before anything is in force; the vector stays when it is approved), with the identity it was made by and the hash of the
     * text it was made from.
     */
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
            .where({ workspaceId, id, status: In(["active", "proposed"]) })
            .setParameter("vector", toVector(vector))
            .execute()
    }

    /**
     * The facts in force nearest to a question's vector, made by the SAME identity only (profile and dimensions): a vector of another
     * identity is never compared, whatever its size. With a lens, only the facts that lens may read are ranked (a customer-facing
     * caller: public facts only), so the limit is never spent on facts the caller cannot see.
     */
    async nearest(
        workspaceId: string,
        identity: EmbeddingIdentity,
        vector: ReadonlyArray<number>,
        limit: number,
        lens?: FactLens,
    ): Promise<ReadonlyArray<NearFact>> {
        if (vector.length !== identity.dimensions) return []
        const distance = "(f.embedding OPERATOR(extensions.<=>) CAST(:vector AS extensions.vector))"
        const query = this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .select("f.id", "id")
            .addSelect(distance, "distance")
            .where(
                "f.workspaceId = :workspaceId AND f.status = 'active' AND f.embedding IS NOT NULL AND f.embeddingModel = :model AND f.embeddingDimensions = :dimensions",
                { workspaceId, model: identity.model, dimensions: identity.dimensions, vector: toVector(vector) },
            )
        if (lens !== undefined) {
            query.andWhere(
                lens.installationId === null
                    ? "f.installationId IS NULL"
                    : "(f.installationId IS NULL OR f.installationId = :installationId)",
                { installationId: lens.installationId },
            )
            query.andWhere(
                lens.audience === "customer"
                    ? "f.scope = 'public'"
                    : "(f.scope <> 'restricted' OR :module = ANY(f.modules))",
                { module: lens.module },
            )
        }
        const ranked: ReadonlyArray<unknown> = await query.orderBy("distance", "ASC").limit(Math.min(limit, 50)).getRawMany()
        return this.withFacts(workspaceId, ranked)
    }

    /**
     * The facts nearest to one STORED fact (by its own vector, read in the database, never sent back and forth), of the same identity
     * and instance scope, in these statuses, under a distance, nearest first; the fact itself is left out. A fact with no vector of this
     * identity finds nothing. This is the candidate read of "the same fact in other words" (`FactEmbeddingsService.nearMeaning`).
     */
    async nearestTo(
        workspaceId: string,
        factId: string,
        identity: EmbeddingIdentity,
        options: NearToOptions,
    ): Promise<ReadonlyArray<NearFact>> {
        if (options.statuses.length === 0) return []
        const distance =
            "(f.embedding OPERATOR(extensions.<=>) (SELECT q.embedding FROM public.brain_facts q WHERE q.workspace_id = :workspaceId AND q.id = :factId AND q.embedding_model = :model AND q.embedding_dimensions = :dimensions))"
        const ranked: ReadonlyArray<unknown> = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .select("f.id", "id")
            .addSelect(distance, "distance")
            .where(
                "f.workspaceId = :workspaceId AND f.id <> :factId AND f.status IN (:...statuses) AND f.embedding IS NOT NULL AND f.embeddingModel = :model AND f.embeddingDimensions = :dimensions",
                {
                    workspaceId,
                    factId,
                    statuses: [...options.statuses],
                    model: identity.model,
                    dimensions: identity.dimensions,
                },
            )
            .andWhere(options.installationId === null ? "f.installationId IS NULL" : "f.installationId = :installationId", {
                installationId: options.installationId,
            })
            .andWhere(`${distance} < :maxDistance`, { maxDistance: options.maxDistance })
            .orderBy("distance", "ASC")
            .limit(Math.min(options.limit, 50))
            .getRawMany()
        return this.withFacts(workspaceId, ranked)
    }

    /** The facts of ranked raw lines (`id`, `distance`), in the rank's order; a line of another shape or a fact gone is left out. */
    private async withFacts(workspaceId: string, ranked: ReadonlyArray<unknown>): Promise<ReadonlyArray<NearFact>> {
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
