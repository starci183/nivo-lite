/** The kinds of place a passage can sit at in its document. */
export type PassagePlaceKind = "page" | "slide" | "sheet"

/** Where in its document a passage sits: the page of a PDF, the slide of a presentation, the sheet of a workbook. */
export interface PassagePlace {
    /** What the label counts. */
    readonly kind: PassagePlaceKind
    /** The page or slide number, or the sheet name. */
    readonly label: string
}

/** A stored place column: a text, or null when the passage has none. */
export type MaybePlaceText = string | null

/** The place of a passage, or null when it has none. */
export type MaybePassagePlace = PassagePlace | null

/** A stretch of a document, or a passage cut from it, with the place it sits at, or null when the file names no places. */
export interface LocatedText {
    /** The place, or null. */
    readonly place: PassagePlace | null
    /** The text. */
    readonly text: string
}

/** The place of the passage at one order of a source. */
export interface PlacedOrder {
    /** The order of the passage in its source. */
    readonly order: number
    /** Its place, or null. */
    readonly place: PassagePlace | null
}

/** The places to write on the stored passages of a source, by order. */
export interface PlaceWrite {
    /** The workspace that owns the source. */
    readonly workspaceId: string
    /** The source. */
    readonly sourceId: string
    /** The place of each order. */
    readonly places: ReadonlyArray<PlacedOrder>
}

/** One passage to store: its text, and whether its vector was made (the caller hands it to the vector index under the stored id). */
export interface ChunkDraft {
    /** The text. */
    readonly text: string
    /** True when the passage's vector was made with the model in use; false for a passage found by words only (no credits). */
    readonly embedded: boolean
    /** Where it sits in its document, or absent when the file names no places. */
    readonly place?: PassagePlace | null
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
    /**
     * The model that made the vectors. The row records it and the hash of an embedded passage but never the vector (the vector index
     * holds it); `indexed_at` stays empty until the index accepts the vector.
     */
    readonly model: string
    /** The passages in order. */
    readonly drafts: ReadonlyArray<ChunkDraft>
}

/** The row a passage was stored under at an order: the id its point takes in the vector index. */
export interface StoredAt {
    /** The order of the passage in its source. */
    readonly order: number
    /** The passage id. */
    readonly id: string
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

/** The embedding model in use, or null when the deployment has none. */
export type ModelInUse = string | null

/** One stored passage that has a vector. */
export interface EmbeddedChunk {
    /** The passage id. */
    readonly id: string
    /** The order of the passage in its source. */
    readonly order: number
    /** The text. */
    readonly text: string
    /** The hash of its text and model, or null for a passage stored before hashes. */
    readonly hash: string | null
    /** The model that made the vector. */
    readonly model: string | null
}

/** A stored passage that goes to another order and keeps its vector. */
export interface ChunkMove {
    /** The passage id. */
    readonly id: string
    /** Its new order. */
    readonly order: number
}

/** A piece of the text that has no stored vector. */
export interface MissingPassage {
    /** Its order in the source. */
    readonly order: number
    /** The text. */
    readonly text: string
}

/** How the pieces of a text use the stored vectors. */
export interface ReusePlan {
    /** The stored passages that change order. */
    readonly moves: ReadonlyArray<ChunkMove>
    /** The pieces to embed. */
    readonly missing: ReadonlyArray<MissingPassage>
}

/** The stored passages of a source put in the places of a new text. */
export interface ChunkArrangement {
    /** The workspace that owns the source. */
    readonly workspaceId: string
    /** The source. */
    readonly sourceId: string
    /** The stored passages that change order. */
    readonly moves: ReadonlyArray<ChunkMove>
    /** How many passages the text has: the passages past it go. */
    readonly count: number
}

/** One stored passage of a source as the Knowledge page shows it. */
export interface PassageView {
    /** The passage id. */
    readonly id: string
    /** The order of the passage in its source. */
    readonly order: number
    /** The text. */
    readonly content: string
    /** Whether the vector index accepted the passage's vector (`indexed_at`): it is found by meaning. */
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

/** The dimensions of every vector (the vector index's collection size); the embeddings provider is asked for exactly this many. */
export const EMBEDDING_DIMENSIONS = 1536

/** What triage says of a passage: `rule` (it states a rule of the shop, read into truths), `data` (shop records, never truths) or `none`. */
export type TriageVerdict = "rule" | "data" | "none"

/** The triage verdict of one passage, to store. */
export interface PassageVerdict {
    /** The passage id. */
    readonly id: string
    /** Its verdict. */
    readonly verdict: TriageVerdict
}

/** A passage of a document as the truths work reads it: its text and where triage and the truth reading stand. */
export interface TruthPassage {
    /** The passage id. */
    readonly id: string
    /** The order of the passage in its source. */
    readonly order: number
    /** The text. */
    readonly text: string
    /** The model-free hash of the text (`passageTextHashOf`). */
    readonly hash: string
    /** The triage verdict, or null while not judged. */
    readonly triage: TriageVerdict | null
    /** The triage prompt version that judged it (0 = judged by code), or null while not judged. */
    readonly triageVersion: number | null
    /** The extraction prompt version its truths were read with, or null while not read. */
    readonly truthsVersion: number | null
}
