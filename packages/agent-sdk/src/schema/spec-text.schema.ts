import { z } from "zod"
import type { SpecText } from "./schema.types"

/** The zod schema of a spec text: a key, or both product languages. */
export const specText: z.ZodType<SpecText> = z.union([
    z.object({ key: z.string().min(1) }).strict(),
    z.object({ vi: z.string(), en: z.string() }).strict(),
])
