import { z } from "zod"
import type { SpecText } from "./schema.types"
import { KEY_MAX, TEXT_MAX } from "./bounds"

/** The zod schema of a spec text: a key, or both product languages. */
export const specText: z.ZodType<SpecText> = z.union([
    z.object({ key: z.string().min(1).max(KEY_MAX) }).strict(),
    z.object({ vi: z.string().max(TEXT_MAX), en: z.string().max(TEXT_MAX) }).strict(),
])
