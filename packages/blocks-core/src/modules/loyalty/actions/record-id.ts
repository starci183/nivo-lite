import { z } from "zod"
import { MAX_ID } from "../../../bounds"

/** The id the host sends with every action; an action on no record gets an empty one, which it ignores. */
export const hostRecordId: z.ZodOptional<z.ZodString> = z.string().max(MAX_ID).optional()
