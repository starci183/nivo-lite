import { z } from "zod"

/**
 * The JSON a critique answers, as it is READ: every field bounded, none narrowed to the critic's own vocabulary. The kinds, the
 * severities and the lengths a point may keep are checked point by point after the parse (`readCritique`), so ONE point with a kind
 * the critic does not know, or a line a few characters too long, never voids the other points of the answer (D-N-2: the prompt named
 * three kinds an enum here refused, and 74 whole answers were thrown away). The bounds here are only what keeps an answer finite:
 * about four times what the prompt asks for.
 */

/** A quote the model cites: a key of the bundle and the words copied from it. */
const critiqueQuote = z.object({ key: z.string().max(16), quote: z.string().max(1200) })

/** One point the critic raises, as written by the model. */
const critiqueFinding = z.object({
    kind: z.string().max(80),
    severity: z.string().max(40),
    line: z.string().max(1200),
    why: z.string().max(2400),
    question: z.string().max(1200),
    quotes: z.array(critiqueQuote).max(24),
    values: z.array(z.string().max(600)).max(12),
})

/** The JSON a critique answers. */
export const DOCUMENT_CRITIQUE_SCHEMA: z.ZodObject<
    {
        findings: z.ZodArray<
            z.ZodObject<
                {
                    kind: z.ZodString
                    severity: z.ZodString
                    line: z.ZodString
                    why: z.ZodString
                    question: z.ZodString
                    quotes: z.ZodArray<z.ZodObject<{ key: z.ZodString; quote: z.ZodString }, z.core.$strip>>
                    values: z.ZodArray<z.ZodString>
                },
                z.core.$strip
            >
        >
    },
    z.core.$strip
> = z.object({ findings: z.array(critiqueFinding).max(60) })

/** The critique answer as parsed. */
export type DocumentCritiqueAnswer = z.infer<typeof DOCUMENT_CRITIQUE_SCHEMA>

