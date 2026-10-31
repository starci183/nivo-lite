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
    /** The agent instance the source is kept for, or null for every instance. */
    readonly installationId: string | null
    /** The model that made the vectors. */
    readonly model: string
    /** The passages in order. */
    readonly drafts: ReadonlyArray<ChunkDraft>
}

/** A passage to store at a fixed place in its source. */
export interface PlacedChunkDraft extends ChunkDraft {
    /** The order of the passage in its source (from 0). */
    readonly order: number
}

/** Some passages of one source, stored in place of the passages at the same orders; the other passages stay. */
export interface ChunkBatchWrite extends Omit<ChunkWrite, "drafts"> {
    /** The passages, each with its order. */
    readonly drafts: ReadonlyArray<PlacedChunkDraft>
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

/** A passage of one of several sources, as the dossier review reads it. */
export interface SourcePassage {
    /** The passage id. */
    readonly id: string
    /** The source it belongs to. */
    readonly sourceId: string
    /** Its order in the source. */
    readonly order: number
    /** The text. */
    readonly text: string
}

/** The dimensions of every stored vector (the pgvector column size); the embeddings provider is asked for exactly this many. */
export const EMBEDDING_DIMENSIONS = 1536

/** What a passage search asks: the lens of the reader and the two halves of the query. */
export interface ChunkQuery {
    /** The workspace. */
    readonly workspaceId: string
    /** The module of the reader: its own passages and those for every module. */
    readonly module: string
    /** customer sees public passages only. */
    readonly audience: "customer" | "internal"
    /** The agent instance whose own passages join the shared ones; null = the shared ones only. */
    readonly installationId: string | null
    /** The query vector in the pgvector text form, or null. */
    readonly vector: string | null
    /** The model the vector comes from; passages of another model score by words only. */
    readonly model: string | null
    /** The words of the query as a tsquery text (`a | b`), or null. */
    readonly tsquery: string | null
    /** The most passages wanted. */
    readonly limit: number
}

/** One passage a search found. */
export interface ChunkHit {
    /** The passage id. */
    readonly id: string
    /** The source the passage was cut from. */
    readonly sourceId: string
    /** The module the passage is for, or null. */
    readonly module: string | null
    /** The text. */
    readonly content: string
    /** The relevance, higher first. */
    readonly score: number
    /** public or internal. */
    readonly visibility: string
    /** The order of the passage in its source. */
    readonly order: number
}
