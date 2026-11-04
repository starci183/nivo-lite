import { z } from "zod"
import { keyText, prose } from "./bounded.schema"
import { entriesAtMost } from "./entries"
import type { JsonValue } from "./schema.types"

/** The zod schema of a JSON value of any depth: strings up to 4000 characters, lists up to 500 items and objects up to 200 members. */
export const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
    z.union([
        prose,
        z.number(),
        z.boolean(),
        z.null(),
        z.array(jsonValue).max(500),
        z.record(keyText, jsonValue).refine(entriesAtMost(200)),
    ]),
)
