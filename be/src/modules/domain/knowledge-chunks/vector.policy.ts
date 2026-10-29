import { EMBEDDING_DIMENSIONS } from "./knowledge-chunks.contracts"

/** The pgvector text form of a vector, accepted by `::vector` casts. */
export const toVector = (vector: ReadonlyArray<number>): string => `[${vector.join(",")}]`

/** True when the endpoint answered exactly one vector of the stored size (the pgvector column) per text. */
export const hasStoredSize = (vectors: ReadonlyArray<ReadonlyArray<number>>, count: number): boolean =>
    vectors.length === count && vectors.every((vector) => vector.length === EMBEDDING_DIMENSIONS)
