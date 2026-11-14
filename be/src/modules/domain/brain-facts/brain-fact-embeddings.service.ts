import { Injectable, Optional } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { toVector } from "@modules/domain/knowledge-chunks"
import { InjectVectorIndex, type VectorIndex, type VectorMatch } from "@modules/integrations/qdrant"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type { FactRecord } from "./brain-facts.contracts"
import type {
    EmbeddedStatus,
    FactEmbeddingState,
    FactLens,
    NearFact,
    NearRead,
    NearToOptions,
    StoredLine,
    WantedLine,
    WantingPage,
} from "./brain-fact-embeddings.contracts"
import { toFactRecord } from "./fact-record.mapper"
import type { EmbeddingIdentity } from "./embedding-standard.policy"
import { BrainFactEntity } from "./persistence/entities"

/** The most rows one embedding read answers. */
const EMBED_READ_MAX = 500

/** The vector of each id, picked from the two arrays one batched write carries (`storeMany`). */
const VECTOR_OF_ID =
    '(SELECT t.embedding::extensions.vector FROM unnest(CAST(:ids AS uuid[]), CAST(:vectors AS text[])) AS t(id, embedding) WHERE t.id = "brain_facts"."id")'

/** The line hash of each id, picked from the two arrays one batched write carries (`storeMany`). */
const HASH_OF_ID =
    '(SELECT t.hash FROM unnest(CAST(:ids AS uuid[]), CAST(:hashes AS text[])) AS t(id, hash) WHERE t.id = "brain_facts"."id")'

/** A column of the first row of the workspace that holds a vector of the same line and identity (read in the same statement). */
const donorOf = (column: string) => (): string =>
    `(SELECT s.${column} FROM public.brain_facts s WHERE s.workspace_id = :workspaceId AND s.embedding IS NOT NULL AND s.embedding_model = :model AND s.embedding_dimensions = :dimensions AND s.embedding_hash = :hash ORDER BY s.id LIMIT 1)`

/** One line of the read of workspaces that wait for a vector. */
interface WorkspaceLine {
    /** The workspace. */
    readonly workspace: string
}

/**
 * The dimensions an embedding identity names (`<model>@<dimensions>`), or null when it names none (a row of the old era). A row whose
 * vector lives in the vector index has no vector column to measure, so its recorded identity says its size.
 */
const dimensionsOfIdentity = (model: string | null | undefined): number | null => {
    const named = /@(\d+)$/u.exec(model ?? "")?.[1]
    return named === undefined ? null : Number(named)
}

/** The statuses whose rows may hold a vector (`EmbeddedStatus`): in force, scheduled for a later start, waiting. */
const VECTOR_STATUSES: ReadonlyArray<EmbeddedStatus> = ["active", "scheduled", "proposed"]

/** The most points one index search of truths asks for. */
const INDEX_SEARCH_MAX = 100

/** A row read with what its stored vector says. */
const stateOf = (row: BrainFactEntity): FactEmbeddingState => ({
    fact: toFactRecord(row),
    stored: {
        model: row.embeddingModel ?? null,
        dimensions: row.embeddingDimensions ?? dimensionsOfIdentity(row.embeddingModel),
        hash: row.embeddingHash ?? null,
    },
})

@Injectable()
/**
 * The vectors of the truth graph's facts, under the embedding standard: a vector is stored with its identity and the hash of its text,
 * a search compares only one identity, and the rows of another identity are found for a re-index. Every read names the workspace.
 */
export class BrainFactEmbeddingsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @Optional() @InjectVectorIndex() private readonly index: VectorIndex | null,
    ) {}

    /**
     * One page of the facts in force of the workspace that need a vector, in id order after `afterId` (a keyset page, so a sweep reaches
     * every row however many there are, never "the first 500"): `missing` = no vector at all (a fact that came in force and was not
     * embedded yet), read on the partial index `brain_facts_active_unembedded (workspace_id, id) WHERE status = 'active' AND embedding IS
     * NULL` (migration 20261112015100); `other_identity` = a vector made by another profile or size (the re-index), read by range on
     * `brain_facts_embedding_model (workspace_id, embedding_model)`. A row whose line changed under the same identity cannot exist: a
     * fact's line is fixed for its row (a new value, label or reach is a new row), so "stale text" is the announced path's case only.
     */
    async wanting(
        workspaceId: string,
        identity: EmbeddingIdentity,
        page: WantingPage,
    ): Promise<ReadonlyArray<FactEmbeddingState>> {
        const { arm, afterId, limit } = page
        const query = this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .where("f.workspaceId = :workspaceId AND f.status = 'active'", { workspaceId })
        if (arm === "missing") query.andWhere("f.embedding IS NULL")
        else
            query.andWhere(
                "f.embedding IS NOT NULL AND (f.embeddingModel < :model OR f.embeddingModel > :model OR f.embeddingDimensions <> :dimensions)",
                { model: identity.model, dimensions: identity.dimensions },
            )
        if (afterId !== null) query.andWhere("f.id > :afterId", { afterId })
        const rows = await query
            .orderBy("f.id", "ASC")
            .limit(Math.max(1, Math.min(limit, EMBED_READ_MAX)))
            .getMany()
        return rows.map((row) => stateOf(row))
    }

    /**
     * The workspaces that hold a fact in force with no vector yet, at most `limit`: what the timed sweep (tick `brain-upkeep`) visits.
     * Read on the partial index `brain_facts_active_unembedded` alone (it holds only those rows).
     */
    async workspacesWanting(limit: number): Promise<ReadonlyArray<string>> {
        const found: ReadonlyArray<WorkspaceLine> = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "w")
            .select("DISTINCT w.workspace_id", "workspace")
            .where("w.status = 'active' AND w.embedding IS NULL")
            .limit(Math.max(1, limit))
            .getRawMany()
        return found.map((line) => line.workspace)
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
        return rows.map((row) => toFactRecord(row))
    }

    /** The facts of the workspace with these ids with what their stored vectors say, in no order. */
    async statesOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<FactEmbeddingState>> {
        const unique = [...new Set(ids)].slice(0, EMBED_READ_MAX)
        if (unique.length === 0) return []
        const rows = await this.entityManager.find(BrainFactEntity, {
            where: { workspaceId, id: In(unique) },
            take: unique.length,
        })
        return rows.map((row) => stateOf(row))
    }

    /**
     * Stores the vector of one fact in force, scheduled or waiting (a proposal is embedded when it is filed, so the same fact in other
     * words is found before anything is in force; the vector stays when it is approved), with the identity it was made by and the hash
     * of the text it was made from.
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
            .where({ workspaceId, id, status: In([...VECTOR_STATUSES]) })
            .setParameter("vector", toVector(vector))
            .execute()
    }

    /**
     * Stores the vectors of one embedding batch in ONE statement (the passages' `setVectors` pattern): each fact in force or waiting
     * gets its vector, the identity and the hash of its line. Nothing is written for an empty batch.
     */
    async storeMany(
        workspaceId: string,
        written: ReadonlyArray<StoredLine>,
        identity: EmbeddingIdentity,
    ): Promise<void> {
        if (written.length === 0) return
        await this.entityManager
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set({ embedding: () => VECTOR_OF_ID, embeddingModel: identity.model, embeddingHash: () => HASH_OF_ID })
            .where(
                "workspace_id = :workspaceId AND id = ANY(CAST(:ids AS uuid[])) AND status IN ('active', 'scheduled', 'proposed')",
            )
            .setParameters({
                workspaceId,
                ids: written.map((one) => one.id),
                vectors: written.map((one) => toVector(one.vector)),
                hashes: written.map((one) => one.hash),
            })
            .execute()
    }

    /**
     * Gives each of these facts (in force or waiting) the vector another row of the workspace already holds for the SAME line under
     * the SAME identity (same text hash, profile and dimensions): a version that keeps its value (a new reach, a value set again, a
     * proposal of a line already known) copies the vector in the database, with no embedding call. Answers the ids that got one; the
     * others still need an embedding. One statement per fact, its donor read on `brain_facts_embedding_model (workspace_id,
     * embedding_model)`.
     */
    async adopt(
        workspaceId: string,
        wanted: ReadonlyArray<WantedLine>,
        identity: EmbeddingIdentity,
    ): Promise<ReadonlySet<string>> {
        const unique = [...new Map(wanted.map((one) => [one.id, one])).values()].slice(0, EMBED_READ_MAX)
        const copied = new Set<string>()
        await eachInOrder(unique, async (one) => {
            if (await this.copyLine(workspaceId, one, identity)) copied.add(one.id)
        })
        return copied
    }

    /** Copies onto one fact the vector of its line another row holds; answers whether one was there to copy. */
    private async copyLine(workspaceId: string, wanted: WantedLine, identity: EmbeddingIdentity): Promise<boolean> {
        const updated = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set({ embedding: donorOf("embedding"), embeddingModel: identity.model, embeddingHash: wanted.hash })
            .where({ workspaceId, id: wanted.id, status: In([...VECTOR_STATUSES]) })
            .andWhere(`EXISTS ${donorOf("id")()}`)
            .setParameters({ workspaceId, model: identity.model, dimensions: identity.dimensions, hash: wanted.hash })
            .execute()
        return (updated.affected ?? 0) > 0
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
        return (await this.nearestRead(workspaceId, identity, vector, limit, lens)).facts
    }

    /** `nearest`, saying whether the vector index answered (`NearRead.indexDown`). */
    async nearestRead(
        workspaceId: string,
        identity: EmbeddingIdentity,
        vector: ReadonlyArray<number>,
        limit: number,
        lens?: FactLens,
    ): Promise<NearRead> {
        if (vector.length !== identity.dimensions) return { facts: [], indexDown: false }
        if (this.index != null) return this.nearestInIndex(this.index, workspaceId, identity, vector, limit, lens)
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
        const ranked: ReadonlyArray<unknown> = await query
            .orderBy("distance", "ASC")
            .limit(Math.min(limit, 50))
            .getRawMany()
        return { facts: await this.withFacts(workspaceId, ranked), indexDown: false }
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
        return (await this.nearestToRead(workspaceId, factId, identity, options)).facts
    }

    /** `nearestTo`, saying whether the vector index answered (`NearRead.indexDown`). */
    async nearestToRead(
        workspaceId: string,
        factId: string,
        identity: EmbeddingIdentity,
        options: NearToOptions,
    ): Promise<NearRead> {
        if (options.statuses.length === 0) return { facts: [], indexDown: false }
        if (this.index != null) return this.nearestToInIndex(this.index, workspaceId, factId, identity, options)
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
            .andWhere(
                options.installationId === null ? "f.installationId IS NULL" : "f.installationId = :installationId",
                {
                    installationId: options.installationId,
                },
            )
            .andWhere(`${distance} < :maxDistance`, { maxDistance: options.maxDistance })
            .orderBy("distance", "ASC")
            .limit(Math.min(options.limit, 50))
            .getRawMany()
        return { facts: await this.withFacts(workspaceId, ranked), indexDown: false }
    }

    /**
     * `nearest` through the vector index (one index call, one Postgres read): the index answers ids and scores inside the scope built
     * from the lens (the workspace, the identity, truths in force, the reader's instance, and for a customer public truths only), then
     * the rows are read back from Postgres and only those in force that the lens may read are kept, in the index's order. A point
     * whose row is gone, superseded or no longer public is dropped here: the index may lag, it never decides what is read. An index
     * that does not answer finds nothing (the word search of the caller stands); it never throws.
     */
    private async nearestInIndex(
        index: VectorIndex,
        workspaceId: string,
        identity: EmbeddingIdentity,
        vector: ReadonlyArray<number>,
        limit: number,
        lens: FactLens | undefined,
    ): Promise<NearRead> {
        const searched = await index
            .search(
                "truth",
                {
                    workspaceId,
                    audience: lens?.audience === "customer" ? "customer" : "internal",
                    module: lens?.module ?? "",
                    installationId: lens?.installationId ?? null,
                    model: identity.model,
                    standing: "in_force",
                },
                vector,
                { limit: Math.min(limit, 50) },
            )
            .then(
                (found) => ({ matches: found }),
                (cause: unknown) => ({ cause }),
            )
        if (!("matches" in searched)) return { facts: [], indexDown: true, cause: searched.cause }
        const { matches } = searched
        const served = (row: BrainFactEntity): boolean => {
            if (row.status !== "active") return false
            if (lens === undefined) return true
            if (row.installationId !== null && row.installationId !== lens.installationId) return false
            return lens.audience === "customer"
                ? row.scope === "public"
                : row.scope !== "restricted" || row.modules.includes(lens.module)
        }
        return { facts: await this.matchedFacts(workspaceId, matches, served), indexDown: false }
    }

    /**
     * `nearestTo` through the vector index: the vector of the fact is read from its own point (a fact with no point finds nothing),
     * the index answers the nearest points of the workspace and identity, waiting truths included, and the rows are read back from
     * Postgres: only these statuses, exactly the instance scope asked for, under the distance, never the fact itself. An index that
     * does not answer finds nothing; it never throws.
     */
    private async nearestToInIndex(
        index: VectorIndex,
        workspaceId: string,
        factId: string,
        identity: EmbeddingIdentity,
        options: NearToOptions,
    ): Promise<NearRead> {
        try {
            const own = (await index.vectorsOf("truth", workspaceId, [factId])).get(factId)
            // No point of the fact yet: the index has not taken it in, so nothing is known of what is near it.
            if (own?.length !== identity.dimensions)
                return { facts: [], indexDown: own === undefined }
            const matches = await index.search(
                "truth",
                {
                    workspaceId,
                    audience: "internal",
                    module: "",
                    installationId: options.installationId,
                    model: identity.model,
                    standing: "any",
                },
                own,
                // The fact itself and, for an instance, the shared truths come back too and are dropped after the read.
                { limit: Math.min(options.limit * 2 + 1, INDEX_SEARCH_MAX) },
            )
            const statuses: ReadonlyArray<string> = options.statuses
            const near = await this.matchedFacts(
                workspaceId,
                matches.filter((match) => match.id !== factId && 1 - match.score < options.maxDistance),
                (row) => statuses.includes(row.status) && row.installationId === options.installationId,
            )
            return { facts: near.slice(0, Math.min(options.limit, 50)), indexDown: false }
        } catch (cause) {
            return { facts: [], indexDown: true, cause }
        }
    }

    /** The facts of what the index matched, read from Postgres and kept when `served` says so, in the index's order, with their distance. */
    private async matchedFacts(
        workspaceId: string,
        matches: ReadonlyArray<VectorMatch>,
        served: (row: BrainFactEntity) => boolean,
    ): Promise<ReadonlyArray<NearFact>> {
        if (matches.length === 0) return []
        const rows = await this.entityManager.find(BrainFactEntity, {
            where: { workspaceId, id: In(matches.map((match) => match.id)) },
            take: matches.length,
        })
        const byId = new Map(rows.filter((row) => served(row)).map((row) => [row.id, toFactRecord(row)]))
        return matches.flatMap((match) => {
            const fact = byId.get(match.id)
            return fact === undefined ? [] : [{ fact, distance: 1 - match.score }]
        })
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
