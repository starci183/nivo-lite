import { z } from "zod"
import type { ZodType } from "zod"

/** A quote the model cites: the key of a passage or fact of the bundle and the words copied from it. */
const citedQuote = z.object({ key: z.string().max(16), quote: z.string().max(300) })

/** One issue the model found in a dossier. */
const reasonedFinding = z.object({
    kind: z.enum(["contradiction", "missing", "expired", "unsigned", "outdated", "unreasonable"]),
    severity: z.enum(["high", "medium", "low"]),
    title: z.string().min(3).max(140),
    detail: z.string().min(3).max(600),
    evidence: z.array(citedQuote).min(1).max(6),
    relatedRefs: z.array(z.string().max(8)).max(5),
    remedyAction: z.enum(["upload", "draft", "decide", "external"]),
    documentType: z.string().max(80).nullable(),
})

/** The model's verdict on one open AI finding it was shown. */
const stillOpenAnswer = z.object({
    key: z.string().max(8),
    applies: z.boolean(),
    evidence: z.array(citedQuote).max(3),
})

/** The JSON a dossier review answers: new findings and the verdict on each open AI finding. */
export const DOSSIER_REVIEW_SCHEMA: z.ZodObject<
    {
        findings: z.ZodArray<
            z.ZodObject<
                {
                    kind: z.ZodEnum<{
                        contradiction: "contradiction"
                        missing: "missing"
                        expired: "expired"
                        unsigned: "unsigned"
                        outdated: "outdated"
                        unreasonable: "unreasonable"
                    }>
                    severity: z.ZodEnum<{
                        high: "high"
                        medium: "medium"
                        low: "low"
                    }>
                    title: z.ZodString
                    detail: z.ZodString
                    evidence: z.ZodArray<
                        z.ZodObject<
                            {
                                key: z.ZodString
                                quote: z.ZodString
                            },
                            z.core.$strip
                        >
                    >
                    relatedRefs: z.ZodArray<z.ZodString>
                    remedyAction: z.ZodEnum<{
                        upload: "upload"
                        draft: "draft"
                        decide: "decide"
                        external: "external"
                    }>
                    documentType: z.ZodNullable<z.ZodString>
                },
                z.core.$strip
            >
        >
        stillOpen: z.ZodArray<
            z.ZodObject<
                {
                    key: z.ZodString
                    applies: z.ZodBoolean
                    evidence: z.ZodArray<
                        z.ZodObject<
                            {
                                key: z.ZodString
                                quote: z.ZodString
                            },
                            z.core.$strip
                        >
                    >
                },
                z.core.$strip
            >
        >
    },
    z.core.$strip
> = z.object({
    findings: z.array(reasonedFinding).max(8),
    stillOpen: z.array(stillOpenAnswer).max(20),
})

/** The review answer as parsed. */
export type DossierReviewAnswer = z.infer<typeof DOSSIER_REVIEW_SCHEMA>

/** The schema a model answer is read with: a bounded zod object whose parsed value is `T`. */
export type AnswerSchema<T> = ZodType<T>
