import { EMBEDDING_DIMENSIONS } from "./knowledge-chunks.contracts"

/** True when the endpoint answered exactly one vector of the index's size per text. */
export const hasStoredSize = (vectors: ReadonlyArray<ReadonlyArray<number>>, count: number): boolean =>
    vectors.length === count && vectors.every((vector) => vector.length === EMBEDDING_DIMENSIONS)
