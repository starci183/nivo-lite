/** Which halves of the hybrid score a search uses: the vector distance, the word match, or both. */
export interface HybridTerms {
    /** True when the query has a vector of the stored model. */
    readonly vector: boolean
    /** True when the query has words. */
    readonly text: boolean
}

/** The vector half of the score: 0.7 of the cosine similarity, for a row whose vector comes from the query model. */
const vectorScore = (alias: string): string =>
    `CASE WHEN ${alias}.embedding IS NOT NULL AND ${alias}.embeddingModel = :model THEN greatest(0, 1 - (${alias}.embedding <=> CAST(:vector AS extensions.vector))) * 0.7 ELSE 0 END`

/** The word half of the score: 0.3 of the capped text rank. */
const textScore = (alias: string): string => `least(1, ts_rank(${alias}.fts, to_tsquery('simple', :tsquery))) * 0.3`

/** The relevance of a row of the alias, 0 to 1, as a `real`; bind `:vector`, `:model` and `:tsquery` for the halves in use. */
export const hybridScore = (alias: string, terms: HybridTerms): string => {
    const parts = [terms.vector ? vectorScore(alias) : "0", terms.text ? textScore(alias) : "0"]
    return `CAST((${parts.join(" + ")}) AS real)`
}

/** Whether a row of the alias matches at all: a close vector (distance under 0.8) or a word match; false when neither half is in use. */
export const hybridHit = (alias: string, terms: HybridTerms): string => {
    const hits = [
        ...(terms.vector
            ? [
                  `(${alias}.embedding IS NOT NULL AND ${alias}.embeddingModel = :model AND (${alias}.embedding <=> CAST(:vector AS extensions.vector)) < 0.8)`,
              ]
            : []),
        ...(terms.text ? [`${alias}.fts @@ to_tsquery('simple', :tsquery)`] : []),
    ]
    return hits.length === 0 ? "false" : `(${hits.join(" OR ")})`
}
