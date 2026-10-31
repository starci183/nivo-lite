import { z } from "zod"

/** One value the draft leaves for the owner to fill in. */
const placeholder = z.object({ label: z.string().max(120), reason: z.string().max(200) })

/** The JSON a remedy draft answers: the document in Markdown and the blanks it leaves. */
export const REMEDY_SCHEMA = z.object({
    title: z.string().min(1).max(160),
    documentType: z.string().max(80),
    body: z.string().min(1).max(40_000),
    placeholders: z.array(placeholder).max(30),
})

/** The remedy answer as parsed. */
export type RemedyAnswer = z.infer<typeof REMEDY_SCHEMA>
