import type { PassagePlace, WordMatch } from "@modules/domain/knowledge-chunks"
import type { PassageLeg } from "@modules/integrations/ai"

/** What one search of the documents is asked. */
export interface PassageSearchRequest {
    /** The words or the question, as the reader wrote them. */
    readonly query: string
    /** auto = words and meaning (one embedding call); words = words only, nothing is embedded or spent. */
    readonly mode: "auto" | "words"
    /** How many hits one page answers. */
    readonly limit: number
    /** The place in the ranked pool the page starts at (0 for the first page; the `next` of the page before). */
    readonly after: number
    /** ranked (the default) = the more of the words, the higher; all = every word; any = one is enough. */
    readonly match?: WordMatch
    /** The query already embedded with the model in use: the search then makes no embedding call of its own. */
    readonly vector?: ReadonlyArray<number>
    /** How long the embedding of the query may take before the search goes on with words alone, milliseconds. */
    readonly embedTimeoutMs?: number
}

/** One passage a search found, with what it cites. */
export interface PassageFound {
    /** The passage id. */
    readonly id: string
    /** The document id. */
    readonly sourceId: string
    /** The title of the document. */
    readonly title: string
    /** When the document last changed, ISO text. */
    readonly updatedAt: string
    /** How many passages the document holds. */
    readonly documentPassages: number
    /** The position of the passage in its document, from 0. */
    readonly order: number
    /** The page, slide or sheet it sits at, or null. */
    readonly place: PassagePlace | null
    /** The module the passage is for, or null for every module. */
    readonly module: string | null
    /** public or internal. */
    readonly visibility: string
    /** True when the trust gate released it to customers. */
    readonly customerReady: boolean
    /** The legs that found it. */
    readonly legs: ReadonlyArray<PassageLeg>
    /** The fused relevance, 0 to 1 (1 = first in both legs). */
    readonly score: number
    /** True when the passage holds every word of the query (a code, or two words or more); absent when not known. */
    readonly complete?: boolean
    /** The whole passage. */
    readonly content: string
}

/** What one search answers. */
export interface PassageSearchAnswer {
    /** The legs that ran: `meaning` is missing when the mode was words or no vector could be had. */
    readonly legs: ReadonlyArray<PassageLeg>
    /** The hits of this page, best first. */
    readonly hits: ReadonlyArray<PassageFound>
    /** Where the next page starts, or null when the ranked pool is used up. */
    readonly next: number | null
    /** Present when the meaning leg was asked for and the vector index did not answer: the hits are by words alone. */
    readonly degraded?: "meaning_unavailable"
}

/** Which stretch of a document to read: around one passage, or from a position of a document. */
export interface PassageReadRequest {
    /** The passage to read around; when given, `sourceId` and `at` are not read. */
    readonly passageId?: string
    /** The document, when no passage is named. */
    readonly sourceId?: string
    /** The position to read from, when no passage is named; 0 when absent. */
    readonly at?: number
    /** How many passages before it. */
    readonly before: number
    /** How many passages after it. */
    readonly after: number
}

/** One passage of a stretch. */
export interface PassageRead {
    /** The passage id. */
    readonly id: string
    /** Its position in the document. */
    readonly order: number
    /** The page, slide or sheet it sits at, or null. */
    readonly place: PassagePlace | null
    /** True when the trust gate released it to customers. */
    readonly customerReady: boolean
    /** The whole passage. */
    readonly content: string
}

/** A stretch of a document, or null when the reader's lens holds nothing of it. */
export type OptionalPassageRead = PassageReadAnswer | null

/** A stretch of a document, in reading order. */
export interface PassageReadAnswer {
    /** The document id. */
    readonly sourceId: string
    /** Its title. */
    readonly title: string
    /** When it last changed, ISO text. */
    readonly updatedAt: string
    /** How many passages it holds. */
    readonly documentPassages: number
    /** The passages, in order. */
    readonly passages: ReadonlyArray<PassageRead>
    /** The position of the nearest passage before the stretch the reader may read, or null at the start. */
    readonly prev: number | null
    /** The position of the nearest passage after the stretch the reader may read, or null at the end. */
    readonly next: number | null
}
