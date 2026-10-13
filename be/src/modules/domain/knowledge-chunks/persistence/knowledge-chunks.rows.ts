/** One passage that already has a vector. */
export interface EmbeddedChunkRow {
    /** The order of the passage in its source. */
    readonly ord: number
    /** The text. */
    readonly content: string
    /** The model that made the vector. */
    readonly embedding_model: string | null
}

/** One passage that needs a vector of the model in use. */
export interface StaleChunkRow {
    /** The passage id. */
    readonly id: string
    /** The text. */
    readonly content: string
}

/** One stored passage as the Knowledge page reads it. */
export interface PassageViewRow {
    /** The passage id. */
    readonly id: string
    /** The order of the passage in its source. */
    readonly ord: number
    /** The text. */
    readonly content: string
    /** Whether the passage has a vector. */
    readonly has_embedding: boolean
}
