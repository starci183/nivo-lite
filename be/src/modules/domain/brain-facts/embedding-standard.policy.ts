import { passageTextHashOf } from "@modules/domain/knowledge-chunks"
import type { FactRecord } from "./brain-facts.contracts"

/**
 * The embedding standard of the truth graph (W2, 2026-11-11; LG-REQUESTS "W2: embedding standard for the truth graph").
 * - A vector is made by ONE pinned identity: the profile name the AI layer embeds with (config `AI_EMBEDDING_MODEL`) and the
 *   dimensions of the stored column (`EMBEDDING_DIMENSIONS`, the one constant `vector(1536)` is declared with). Never a fallback.
 * - Every stored vector row records its identity (`embedding_model`) and its dimensions (`embedding_dimensions`, computed by the
 *   database from the vector), and a search compares only vectors of the identity it embedded the question with.
 * - What is embedded is a text whose `passageTextHashOf` (normalised text, model-free) is stored beside the vector: the same hash
 *   under the same identity means "unchanged, do not embed again".
 * - Another identity means a re-index job over the rows of the old one, never a mix.
 */
export interface EmbeddingIdentity {
    /** The pinned profile or model name the vector was made with. */
    readonly model: string
    /** The vector size. */
    readonly dimensions: number
}

/** What a stored row says about its vector. */
export interface StoredEmbedding {
    /** The identity it was made with, or null when the row has no vector. */
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
