import { EMBEDDING_DIMENSIONS, type MaybeStoredVector } from "./knowledge-chunks.contracts"

/** The pgvector text form of a vector, accepted by `::vector` casts. */
export const toVector = (vector: ReadonlyArray<number>): string => `[${vector.join(",")}]`

/** True when the endpoint answered exactly one vector of the stored size (the pgvector column) per text. */
export const hasStoredSize = (vectors: ReadonlyArray<ReadonlyArray<number>>, count: number): boolean =>
    vectors.length === count && vectors.every((vector) => vector.length === EMBEDDING_DIMENSIONS)

/**
 * A vector as the database answers the pgvector column (its text form `[0.1,0.2]`, or numbers already), or null when it reads as
 * neither or has another size than the stored one.
 */
export const storedVectorOf = (stored: unknown): MaybeStoredVector => {
    const list: unknown = typeof stored === "string" ? stored.replaceAll(/^\[|\]$/gu, "").split(",").map(Number) : stored
    if (!Array.isArray(list) || list.length !== EMBEDDING_DIMENSIONS) return null
    return list.every((value): value is number => typeof value === "number" && Number.isFinite(value)) ? list : null
}
