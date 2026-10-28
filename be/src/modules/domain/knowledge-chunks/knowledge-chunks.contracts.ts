/** One passage to store: its text and its vector in the pgvector text form, or null when it has none. */
export interface ChunkDraft {
    /** The text. */
    readonly text: string
    /** The vector as `[a,b,...]`, or null for a passage found by keyword only. */
    readonly vector: string | null
}

/** The passages of one source, to replace what is stored. */
export interface ChunkWrite {
    /** The workspace that owns the source. */
    readonly workspaceId: string
    /** The source the passages come from. */
    readonly sourceId: string
    /** The module the source is for, or null for every module. */
    readonly module: string | null
    /** public or internal. */
    readonly visibility: string
    /** The model that made the vectors. */
    readonly model: string
    /** The passages in order. */
    readonly drafts: ReadonlyArray<ChunkDraft>
}

/** One stored passage that has a vector. */
export interface EmbeddedChunk {
    /** The order of the passage in its source. */
    readonly order: number
    /** The text. */
    readonly text: string
    /** The model that made the vector. */
    readonly model: string | null
}

/** One stored passage that needs a vector. */
export interface StaleChunk {
    /** The passage id. */
    readonly id: string
    /** The text. */
    readonly text: string
}

/** Vectors to give to stored passages. */
export interface VectorWrite {
    /** The workspace that owns the passages. */
    readonly workspaceId: string
    /** The model that made the vectors. */
    readonly model: string
    /** The passage ids. */
    readonly ids: ReadonlyArray<string>
    /** One vector per id, in the pgvector text form. */
    readonly vectors: ReadonlyArray<string>
}

/** One stored passage of a source as the Knowledge page shows it. */
export interface PassageView {
    /** The passage id. */
    readonly id: string
    /** The order of the passage in its source. */
    readonly order: number
    /** The text. */
    readonly content: string
    /** Whether the passage has a vector. */
    readonly hasEmbedding: boolean
}

/** The dimensions of every stored vector (the pgvector column size); the embeddings provider is asked for exactly this many. */
export const EMBEDDING_DIMENSIONS = 1536
