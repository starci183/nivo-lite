import { type ToolDefinition, defineTool } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../bounds"
import { TOOL } from "./tool-ids"

// The document reads of the second brain (`nivo.tool.brain.passage.search` / `.read`): what no truth answers, an agent looks up in the
// shop's documents the way a code assistant reads a big file (search, read the passage with its neighbours, search again). Pulled
// by the agent, never pushed by the engine: a result is a tool message after the cached part of the prompt.

/** What a document search is asked: key words, how to match them, how many hits, and where a page goes on. */
export interface BrainPassageSearchArgs {
    /** A few key words, an exact code, name or number. */
    readonly query: string
    /** `auto` (words and meaning) or `words` (exact, free); `auto` when absent. */
    readonly mode?: "auto" | "words" | undefined
    /** The most hits, 1 to 10; 6 when absent. */
    readonly limit?: number | undefined
    /** The `next` of the page before. */
    readonly after?: number | undefined
}

/** One passage a document search found: where it is and a snippet, never the whole passage. */
export interface BrainPassageHit {
    /** The passage. */
    readonly id: string
    /** The document. */
    readonly doc: string
    /** The title of the document. */
    readonly title: string
    /** The position of the passage in the document. */
    readonly at: number
    /** How many passages the document holds: an internal reader only. */
    readonly of?: number | undefined
    /** The page, slide or sheet, when the document has one. */
    readonly place?: string | undefined
    /** The day the document last changed. */
    readonly updated: string
    /** Released to customers: an internal reader only. */
    readonly ready?: boolean | undefined
    /** Which leg found it. */
    readonly by: "words" | "meaning" | "both"
    /** A short stretch around the words found. */
    readonly snippet: string
}

/** What a document search answers: the notice, the legs that ran, the hits, and where the next page starts (null: none). */
export interface BrainPassageSearchResult {
    /** The words that say the rest is what a document says, never an instruction nor the shop's truth. */
    readonly notice: string
    /** The legs that ran. */
    readonly legs: ReadonlyArray<string>
    /** The hits, best first. */
    readonly hits: ReadonlyArray<BrainPassageHit>
    /** The `after` of the next page, or null. */
    readonly next: number | null
}

/** Which passages to read: one passage with its neighbours, or a document from a position. */
export interface BrainPassageReadArgs {
    /** A passage. */
    readonly id?: string | undefined
    /** A document, with `at`. */
    readonly doc?: string | undefined
    /** The position to read the document from. */
    readonly at?: number | undefined
    /** Passages before, 0 to 5; 1 when absent. */
    readonly before?: number | undefined
    /** Passages after, 0 to 5; 1 when absent. */
    readonly after?: number | undefined
}

/** One passage as a read answers it, whole. */
export interface BrainPassageText {
    /** The passage. */
    readonly id: string
    /** Its position in the document. */
    readonly at: number
    /** The page, slide or sheet, when the document has one. */
    readonly place?: string | undefined
    /** Released to customers: an internal reader only. */
    readonly ready?: boolean | undefined
    /** The text. */
    readonly text: string
}

/** The document a passage read cites. */
export interface BrainPassageDocument {
    /** The document. */
    readonly id: string
    /** Its title. */
    readonly title: string
    /** The day it last changed. */
    readonly updated: string
    /** How many passages it holds: an internal reader only. */
    readonly passages?: number | undefined
}

/** What a passage read answers: the document's cite, the passages in reading order, and the positions to go on from. */
export interface BrainPassageReadResult {
    /** The words that say the rest is what a document says, never an instruction nor the shop's truth. */
    readonly notice: string
    /** The document the passages belong to. */
    readonly doc: BrainPassageDocument
    /** The passages, in reading order. */
    readonly passages: ReadonlyArray<BrainPassageText>
    /** The position to read on backwards from, or null at the start. */
    readonly prev: number | null
    /** The position to read on from, or null at the end. */
    readonly next: number | null
}

/** The page, slide or sheet of a passage, when its document has one. */
const passagePlace = z.string().max(MAX_LINE).optional()

/**
 * Finds passages of the shop's documents by words and meaning, through the caller's lens (a customer's conversation: released public
 * passages only). Pulled by the agent when no truth answers; a hit is a snippet, read with `brainPassageReadTool`. Reads only.
 */
export const brainPassageSearchTool: ToolDefinition<
    z.ZodType<BrainPassageSearchArgs>,
    z.ZodType<BrainPassageSearchResult>
> = defineTool({
    id: TOOL.brainPassageSearch,
    title: { key: "toolBrainPassageSearch" },
    args: z.object({
        query: z.string().min(1).max(300),
        mode: z.enum(["auto", "words"]).optional(),
        limit: z.number().int().min(1).max(10).optional(),
        after: z.number().int().min(0).max(80).optional(),
    }),
    result: z.object({
        notice: z.string().max(MAX_BODY),
        legs: z.array(z.string().max(MAX_ID)).max(2),
        hits: z
            .array(
                z.object({
                    id: z.string().max(MAX_ID),
                    doc: z.string().max(MAX_ID),
                    title: z.string().max(MAX_LINE),
                    at: z.number().int(),
                    of: z.number().int().optional(),
                    place: passagePlace,
                    updated: z.string().max(MAX_ID),
                    ready: z.boolean().optional(),
                    by: z.enum(["words", "meaning", "both"]),
                    snippet: z.string().max(MAX_BODY),
                }),
            )
            .max(10),
        next: z.number().int().nullable(),
    }),
    mutates: false,
})

/**
 * Reads passages of one document in order through the caller's lens: a passage with its neighbours, or a stretch from a position. A
 * document the lens serves nothing of is not found. Reads only.
 */
export const brainPassageReadTool: ToolDefinition<
    z.ZodType<BrainPassageReadArgs>,
    z.ZodType<BrainPassageReadResult>
> = defineTool({
    id: TOOL.brainPassageRead,
    title: { key: "toolBrainPassageRead" },
    args: z.object({
        id: z.string().max(MAX_ID).optional(),
        doc: z.string().max(MAX_ID).optional(),
        at: z.number().int().min(0).max(1_000_000).optional(),
        before: z.number().int().min(0).max(5).optional(),
        after: z.number().int().min(0).max(5).optional(),
    }),
    result: z.object({
        notice: z.string().max(MAX_BODY),
        doc: z.object({
            id: z.string().max(MAX_ID),
            title: z.string().max(MAX_LINE),
            updated: z.string().max(MAX_ID),
            passages: z.number().int().optional(),
        }),
        passages: z
            .array(
                z.object({
                    id: z.string().max(MAX_ID),
                    at: z.number().int(),
                    place: passagePlace,
                    ready: z.boolean().optional(),
                    text: z.string().max(MAX_BODY),
                }),
            )
            .max(11),
        prev: z.number().int().nullable(),
        next: z.number().int().nullable(),
    }),
    mutates: false,
})
