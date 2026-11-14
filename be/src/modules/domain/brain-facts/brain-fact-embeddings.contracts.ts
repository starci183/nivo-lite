import type { FactAudience, FactRecord, InstallationScope } from "./brain-facts.contracts"
import type { StoredEmbedding } from "./embedding-standard.policy"

/** Which facts in force a sweep page reads: those with no vector, or those whose vector another identity made (the re-index). */
export type WantingArm = "missing" | "other_identity"

/** One keyset page of a sweep: which facts, after which id, how many. */
export interface WantingPage {
    /** No vector yet, or another identity's. */
    readonly arm: WantingArm
    /** The last id of the page before (pages go in id order); null for the first page. */
    readonly afterId: string | null
    /** At most this many (never above one read's bound). */
    readonly limit: number
}

/** A fact whose line needs a vector: its id and the hash of its line. */
export interface WantedLine {
    /** The fact. */
    readonly id: string
    /** The hash of its embedded line (`factEmbedHashOf`). */
    readonly hash: string
}

/** One vector to store: the fact, its vector and the hash of the line it was made from. */
export interface StoredLine extends WantedLine {
    /** The vector. */
    readonly vector: ReadonlyArray<number>
}

/** A fact in force with what its stored vector says. */
export interface FactEmbeddingState {
    /** The fact. */
    readonly fact: FactRecord
    /** Its stored vector's identity and hash. */
    readonly stored: StoredEmbedding
}

/**
 * The statuses whose rows may hold a vector: facts in force, facts decided for a later start (`scheduled`) and proposals embedded when
 * they are filed (the last two to find the same fact in other words).
 */
export type EmbeddedStatus = "active" | "scheduled" | "proposed"

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
