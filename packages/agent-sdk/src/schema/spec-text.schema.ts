import { z } from "zod"
import { ident, prose } from "./bounded.schema"
import type { SpecText } from "./schema.types"

/** The zod schema of a spec text: a key, or both product languages. */
export const specText: z.ZodType<SpecText> = z.union([
    z.object({ key: ident.min(1) }).strict(),
    z.object({ vi: prose, en: prose }).strict(),
])
