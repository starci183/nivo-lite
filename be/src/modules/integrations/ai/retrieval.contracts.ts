/** Which leg of the hybrid search found a passage. */
export type PassageLeg = "words" | "meaning"

/** Where in its document a passage sits (a page, a slide, a sheet), as the store names it. */
export interface RetrievedPlace {
    /** What the label counts. */
    readonly kind: string
    /** The page or slide number, or the sheet name. */
    readonly label: string
}

/** One passage as the caller's store hands it to a retriever: already inside the caller's access lane. */
export interface RetrievedPassage {
    /** The passage id. */
    readonly id: string
    /** The document it was cut from. */
    readonly documentId: string
    /** Its position in the document, from 0. */
    readonly position: number
    /** The text. */
    readonly content: string
    /** True when the passage may be given to a customer. */
    readonly customerReady: boolean
    /** Where it sits, or null. */
    readonly place: RetrievedPlace | null
    /**
     * On a hit of the word leg: true when it holds every word of the query (a code, or two words or more). The fusion counts such a
     * hit `COMPLETE_WORDS_WEIGHT` times, so an exact match is not pushed down by passages that are only near in meaning.
     */
    readonly complete?: boolean
}

/** A passage the meaning leg found, with how near it is. */
export interface NearPassage extends RetrievedPassage {
    /** The cosine similarity to the query, 1 = the same direction. */
    readonly similarity: number
}

/** What a passage cites of its document. */
export interface RetrievedCite {
    /** The title. */
    readonly title: string
    /** When the document last changed, ISO text. */
    readonly updatedAt: string
    /** How many passages it holds. */
    readonly passages: number
}

/** The cites of documents, by document id. */
export type RetrievedCites = ReadonlyMap<string, RetrievedCite>

/**
 * The store a retriever reads, as the calling domain service hands it over (BE-AI-5): every function is ALREADY scoped to the
 * caller's access lane (workspace, audience, lens), so nothing the caller may not read can come back, whatever the query says.
 */
export interface PassageSource {
    /** The passages that hold the words of the query, best first. */
    readonly byWords: (query: string, limit: number) => Promise<ReadonlyArray<RetrievedPassage>>
    /** The passages nearest to a query vector, nearest first. */
    readonly byVector: (vector: ReadonlyArray<number>, limit: number) => Promise<ReadonlyArray<NearPassage>>
    /** What these documents are cited as. */
    readonly cites: (documentIds: ReadonlyArray<string>) => Promise<RetrievedCites>
}

/**
 * Embeds texts through the caller's own metered path: the vectors in order, or null when there are none (no key, no credits, a failed
 * or slow call). The caller books the call; this integration never builds an embeddings client of its own for a retrieval.
 */
export type EmbedTexts = (texts: ReadonlyArray<string>) => Promise<ReadonlyArray<ReadonlyArray<number>> | null>

/** What a retrieved `Document` carries beside its text: everything an agent cites, and how the passage was found. */
export interface PassageMetadata {
    /** The passage id. */
    readonly passageId: string
    /** The document id. */
    readonly documentId: string
    /** The title of the document, or null when the document is gone. */
    readonly title: string | null
    /** When the document last changed, ISO text, or null. */
    readonly updatedAt: string | null
    /** How many passages the document holds, or null. */
    readonly documentPassages: number | null
    /** The position of the passage in its document, from 0. */
    readonly position: number
    /** Where it sits, or null. */
    readonly place: RetrievedPlace | null
    /** True when the passage may be given to a customer. */
    readonly customerReady: boolean
    /** The legs that found it. */
    readonly legs: ReadonlyArray<PassageLeg>
    /** Its rank in the word leg, from 1, or null. */
    readonly wordRank: number | null
    /** Its rank in the meaning leg, from 1, or null. */
    readonly meaningRank: number | null
    /** Its cosine similarity to the query, or null when the meaning leg did not find it. */
    readonly similarity: number | null
    /** The fused score (reciprocal rank), higher first. */
    readonly score: number
}
