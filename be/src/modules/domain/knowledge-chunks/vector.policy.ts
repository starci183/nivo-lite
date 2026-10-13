/** The pgvector text form of a vector, accepted by `::vector` casts. */
export const toVector = (vector: ReadonlyArray<number>): string => `[${vector.join(",")}]`
