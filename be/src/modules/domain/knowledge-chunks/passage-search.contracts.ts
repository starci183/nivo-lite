import type { PassagePlace } from "./knowledge-chunks.contracts"

/** Who reads passages: the workspace, the module and instance of the reader, and the audience the read answers for. */
export interface PassageLens {
    /** The workspace; every statement filters on it. */
    readonly workspaceId: string
    /** The module of the reader: its own passages and those for every module. */
    readonly module: string
    /** customer = public passages the trust gate released, nothing else; internal = every passage of the lens. */
    readonly audience: "customer" | "internal"
    /** The agent instance whose own passages join the shared ones; null = the shared ones only. */
    readonly installationId: string | null
}

/** One stored passage as a read answers it. */
export interface StoredPassage {
    /** The passage id (stable while its text is unchanged). */
    readonly id: string
    /** The document it was cut from. */
    readonly sourceId: string
    /** The module the passage is for, or null for every module. */
    readonly module: string | null
    /** Its position in the document, from 0. */
    readonly order: number
    /** The text. */
    readonly content: string
    /** public or internal. */
    readonly visibility: string
    /** True when the trust gate released it to customers. */
    readonly customerReady: boolean
    /** The page, slide or sheet it sits at, or null. */
    readonly place: PassagePlace | null
}

/** A stored passage, or null when the lens does not hold it. */
export type OptionalStoredPassage = StoredPassage | null

/** A passage the word leg found, with its text rank (higher first). */
export interface WordHit extends StoredPassage {
    /** The rank of the words in the passage (higher first). */
    readonly rank: number
    /** True when the passage holds every word of the query (a code, or two words or more): the fusion counts it first. */
    readonly complete: boolean
}

/** A passage the meaning leg found, with its cosine distance to the query (lower first). */
export interface MeaningHit extends StoredPassage {
    /** The cosine distance, 0 (same direction) to 2. */
    readonly distance: number
}

/**
 * How the words of a query must appear: every one of them, at least one, or `ranked`: a passage holding a code of the query or two of
 * its words is a hit, and the more of them it holds the higher it ranks (a code weighs three words).
 */
export type WordMatch = "all" | "any" | "ranked"

/** What the word leg is asked. */
export interface WordQuery {
    /** The words as the reader wrote them (web-search syntax: `"a phrase"`, `-not`); folded by the database like the index. */
    readonly words: string
    /** all = every word must appear (the default); any = one is enough; ranked = the more of them, the higher. */
    readonly match?: WordMatch
    /** The most passages wanted. */
    readonly limit: number
}

/** What the meaning leg is asked. */
export interface MeaningQuery {
    /** The query vector in the pgvector text form. */
    readonly vector: string
    /** The model identity the vector comes from; only passages of it are compared. */
    readonly model: string
    /** The most passages wanted. */
    readonly limit: number
}

/** A stretch of one document, read in order. */
export interface PassageStretch {
    /** The document. */
    readonly sourceId: string
    /** Read from this position. */
    readonly from: number
    /** forward = this position and later, ascending; backward = earlier positions, descending. */
    readonly direction: "forward" | "backward"
    /** The most passages wanted. */
    readonly limit: number
}
