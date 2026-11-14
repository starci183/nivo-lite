import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { InjectVectorIndex, type VectorIndex, type VectorMatch } from "@modules/integrations/qdrant"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { FactEmbeddingState, FactLens, NearFact, NearRead, NearToOptions } from "./brain-fact-embeddings.contracts"
import { toFactRecord } from "./fact-record.mapper"
import type { EmbeddingIdentity } from "./embedding-standard.policy"
import { BrainFactEntity } from "./persistence/entities"

/** The most rows one embedding read answers. */
const EMBED_READ_MAX = 500

/**
 * The dimensions an embedding identity names (`<model>@<dimensions>`), or null when it names none. Postgres holds no vector to
 * measure: the identity the index accepted the fact's point under says its size.
 */
const dimensionsOfIdentity = (model: string | null | undefined): number | null => {
    const named = /@(\d+)$/u.exec(model ?? "")?.[1]
    return named === undefined ? null : Number(named)
}

/** The most points one index search of truths asks for. */
const INDEX_SEARCH_MAX = 100

/** The most facts one meaning read answers. */
const NEAR_MAX = 50

/** A row read with what Postgres records of its point (the identity and the hash the index accepted). */
const stateOf = (row: BrainFactEntity): FactEmbeddingState => ({
    fact: toFactRecord(row),
    stored: {
        model: row.embeddingModel ?? null,
        dimensions: dimensionsOfIdentity(row.embeddingModel),
        hash: row.embeddingHash ?? null,
    },
})

@Injectable()
/**
 * The meaning reads of the truth graph's facts, under the embedding standard: a fact's vector lives in the vector index only (kind
 * `truth`, one point per fact row), a search is an index query inside its mandatory filters (the workspace, the identity of the query
 * vector, the standing, the reader's instance and audience), then the rows are read from Postgres by id in the reader's lens. Every
 * read names the workspace.
 */
export class BrainFactEmbeddingsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectVectorIndex() private readonly index: VectorIndex,
    ) {}

    /** The facts of the workspace with these ids with what Postgres records of their points, in no order. */
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

    /**
     * `nearest`, saying whether the vector index answered (`NearRead.indexDown`). One index call, one Postgres read: the index answers
     * ids and scores inside the scope built from the lens (the workspace, the identity, truths in force, the reader's instance, and for
     * a customer public truths only), then the rows are read back from Postgres and only those in force that the lens may read are
     * kept, in the index's order. A point whose row is gone, superseded or no longer public is dropped here: the index may lag, it
     * never decides what is read. An index that does not answer finds nothing (the word search of the caller stands); it never throws.
     */
    async nearestRead(
        workspaceId: string,
        identity: EmbeddingIdentity,
        vector: ReadonlyArray<number>,
        limit: number,
        lens?: FactLens,
    ): Promise<NearRead> {
        if (vector.length !== identity.dimensions) return { facts: [], indexDown: false }
        const searched = await this.index
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
                { limit: Math.min(limit, NEAR_MAX) },
            )
            .then(
                (found) => ({ matches: found }),
                (cause: unknown) => ({ cause }),
            )
        if (!("matches" in searched)) return { facts: [], indexDown: true, cause: searched.cause }
        const served = (row: BrainFactEntity): boolean => {
            if (row.status !== "active") return false
            if (lens === undefined) return true
            if (row.installationId !== null && row.installationId !== lens.installationId) return false
            return lens.audience === "customer"
                ? row.scope === "public"
                : row.scope !== "restricted" || row.modules.includes(lens.module)
        }
        return { facts: await this.matchedFacts(workspaceId, searched.matches, served), indexDown: false }
    }

    /**
     * The facts nearest to one STORED fact (by its own point's vector, read from the index), of the same identity and instance scope, in
     * these statuses, under a distance, nearest first; the fact itself is left out. A fact with no point of this identity finds
     * nothing. This is the candidate read of "the same fact in other words" (`FactEmbeddingsService.nearMeaning`).
     */
    async nearestTo(
        workspaceId: string,
        factId: string,
        identity: EmbeddingIdentity,
        options: NearToOptions,
    ): Promise<ReadonlyArray<NearFact>> {
        return (await this.nearestToRead(workspaceId, factId, identity, options)).facts
    }

    /**
     * `nearestTo`, saying whether the vector index answered (`NearRead.indexDown`): the vector of the fact is read from its own point (a
     * fact with no point finds nothing, and says the index has not taken it in), the index answers the nearest points of the workspace
     * and identity, waiting truths included, and the rows are read back from Postgres: only these statuses, exactly the instance scope
     * asked for, under the distance, never the fact itself. An index that does not answer finds nothing; it never throws.
     */
    async nearestToRead(
        workspaceId: string,
        factId: string,
        identity: EmbeddingIdentity,
        options: NearToOptions,
    ): Promise<NearRead> {
        if (options.statuses.length === 0) return { facts: [], indexDown: false }
        try {
            const own = (await this.index.vectorsOf("truth", workspaceId, [factId])).get(factId)
            // No point of the fact yet: the index has not taken it in, so nothing is known of what is near it.
            if (own?.length !== identity.dimensions) return { facts: [], indexDown: own === undefined }
            const matches = await this.index.search(
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
            return { facts: near.slice(0, Math.min(options.limit, NEAR_MAX)), indexDown: false }
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
}
