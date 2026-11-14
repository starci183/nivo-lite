import { z } from "zod"
import { MAX_BODY_CHARS } from "./public-documents.contracts"

/** The model's answer to one draft call. */
export interface DraftAnswer {
    /** False when the documents do not hold what the text is asked for (with a customer question: they do not answer it). */
    readonly answers: boolean
    /** The text for customers; empty when `answers` is false. */
    readonly body: string
}

/**
 * The JSON a draft answers. A body longer than a public document may be does not fit, and an answer that does not parse is
 * unreadable as a whole (the structured output is `DRAFT_OUTPUT_SCHEMA`).
 */
export const DRAFT_READ_SCHEMA: z.ZodType<DraftAnswer> = z.object({
    answers: z.boolean(),
    body: z.string().max(MAX_BODY_CHARS),
})
