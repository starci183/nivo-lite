import { z } from "zod"

/** A quote the model cites: a key of the bundle and the words copied from it. */
const critiqueQuote = z.object({ key: z.string().max(8), quote: z.string().max(300) })

/** One point the critic raises. */
const critiqueFinding = z.object({
    kind: z.enum([
        "inside_contradiction",
        "shop_contradiction",
        "other_document",
        "typo",
        "arithmetic",
        "vague",
        "missing",
        "template",
        "stale_date",
    ]),
    severity: z.enum(["high", "medium", "low"]),
    line: z.string().min(3).max(200),
    why: z.string().min(3).max(600),
    question: z.string().min(3).max(300),
    quotes: z.array(critiqueQuote).min(1).max(4),
    values: z.array(z.string().max(120)).max(2),
})

/** The JSON a critique answers. */
export const DOCUMENT_CRITIQUE_SCHEMA = z.object({ findings: z.array(critiqueFinding).max(12) })

/** The critique answer as parsed. */
export type DocumentCritiqueAnswer = z.infer<typeof DOCUMENT_CRITIQUE_SCHEMA>
