import { z } from "zod"
import { MAX_BODY_CHARS } from "./public-documents.contracts"

/** The JSON a draft answers: the text for customers. */
export const DRAFT_SCHEMA: z.ZodObject<
    {
        body: z.ZodString
    },
    z.core.$strip
> = z.object({ body: z.string().min(1).max(MAX_BODY_CHARS) })

/** The draft answer as parsed. */
export type DraftAnswer = z.infer<typeof DRAFT_SCHEMA>
