import { passageTextHashOf } from "@modules/domain/knowledge-chunks"
import type { FactRecord } from "./brain-facts.contracts"

/**
 * The embedding standard of the truth graph (W2, 2026-11-11; LG-REQUESTS "W2: embedding standard for the truth graph").
 * - A vector is made by ONE pinned identity: the MODEL identity behind the profile the AI layer embeds with (`AiService
 *   .embeddingModel()`, `<model>@<dimensions>`, e.g. `text-embedding-3-small@1536`; E1 2026-11-11: never the profile name, so a
 *   profile re-pointed to another model makes every old vector stale) and the dimensions of the index's collections
 *   (`EMBEDDING_DIMENSIONS`). Never a fallback.
 * - The vector lives in the vector index only; the row records the identity of its accepted point (`embedding_model`, which names
 *   the dimensions) and a search compares only points of the identity it embedded the question with (the index's filter).
 * - What is embedded is a text whose `passageTextHashOf` (normalised text, model-free) is recorded with the point: the same hash
 *   under the same identity means "unchanged, do not embed again".
 * - Another identity makes every point stale: the reconcile embeds the rows again, never a mix.
 */
export interface EmbeddingIdentity {
    /** The model identity the vector was made with (`<model>@<dimensions>`); rows of the old era carry the profile name `embed`. */
    readonly model: string
    /** The vector size. */
    readonly dimensions: number
}

/** What a stored row says about its vector. */
export interface StoredEmbedding {
    /** The identity its accepted point was made with, or null when the row has no point. */
    readonly model: string | null
    /** Its dimensions, or null. */
    readonly dimensions: number | null
    /** The hash of the text it was made from, or null. */
    readonly hash: string | null
}

/** What of a fact is embedded. */
export type EmbeddableFact = Pick<FactRecord, "subjectLabel" | "attributeLabel" | "value" | "unit">

/** What of a stored vector names its identity. */
export type StoredIdentity = Pick<StoredEmbedding, "model" | "dimensions">

/** The line of a fact that is embedded: subject, attribute and value with its unit, as one sentence. */
export const factEmbedTextOf = (fact: EmbeddableFact): string => {
    const value = fact.unit === null ? fact.value : `${fact.value} ${fact.unit}`
    return `${fact.subjectLabel} - ${fact.attributeLabel}: ${value}`
}

/** The hash that keys a fact's vector: the passage hash of its line, the same rule a document chunk follows. */
export const factEmbedHashOf = (fact: EmbeddableFact): string => passageTextHashOf(factEmbedTextOf(fact))

/** Whether a stored vector was made by this identity. */
export const sameIdentity = (stored: StoredIdentity, identity: EmbeddingIdentity): boolean =>
    stored.model === identity.model && stored.dimensions === identity.dimensions

/** Whether a row needs a (new) vector: none yet, another identity, or its text changed. */
export const needsEmbedding = (stored: StoredEmbedding, hash: string, identity: EmbeddingIdentity): boolean =>
    !sameIdentity(stored, identity) || stored.hash !== hash
