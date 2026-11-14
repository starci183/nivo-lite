import type { FactAudience, FactRecord, InstallationScope } from "./brain-facts.contracts"
import type { StoredEmbedding } from "./embedding-standard.policy"

/** A fact with what Postgres records of its point (the identity and the hash of the line the index accepted). */
export interface FactEmbeddingState {
    /** The fact. */
    readonly fact: FactRecord
    /** The identity and hash of its accepted point. */
    readonly stored: StoredEmbedding
}

/**
 * The statuses whose rows hold a point: facts in force, facts decided for a later start (`scheduled`) and proposals embedded when
 * they are filed (the last two to find the same fact in other words).
 */
export type EmbeddedStatus = "active" | "scheduled" | "proposed"

/** Whose view a vector search of facts answers for: the same lens as the word search (`visibleTo`), in the index's filter and on the rows read back. */
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

/**
 * A meaning read that says whether it could look at all: `indexDown` when the vector index did not answer, so "nothing near" is not
 * mistaken for "nothing like it" (the search falls back to words and says so; the same-meaning check counts the fact as unknown).
 */
export interface NearRead {
    /** The facts found, nearest first. */
    readonly facts: ReadonlyArray<NearFact>
    /** True when the vector index did not answer: the facts are none for that reason alone. */
    readonly indexDown: boolean
    /** Why the index did not answer, when it threw (kept for the caller that reports it). */
    readonly cause?: unknown
}
