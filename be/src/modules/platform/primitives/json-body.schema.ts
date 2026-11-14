import { z } from "zod"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"

/**
 * The bounds of JSON a caller or a handler passes through untouched (a workbench read's variables and rows, a record's field values,
 * a remembered fact): every string, list and object is bounded here, never the depth (the data's own shape decides it). The ceilings are
 * generous on purpose, so a real value always fits; they only keep a value finite.
 */
const STRING_MAX = 1_048_576
const ITEMS_MAX = 10_000
const ENTRIES_MAX = 1_000
const KEY_MAX = 200

/** A JSON value whose strings, lists and objects are bounded. */
export const jsonBodySchema: z.ZodType<JsonValue> = z.lazy(() =>
    z.union([
        z.string().max(STRING_MAX),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(jsonBodySchema).max(ITEMS_MAX),
        z
            .record(z.string().max(KEY_MAX), jsonBodySchema)
            .refine((entries) => Object.keys(entries).length <= ENTRIES_MAX, { message: "too many entries" }),
    ]),
)

/** A JSON object whose entries are bounded: the same bounds, an object at the top. */
export const jsonRecordSchema: z.ZodType<Readonly<Record<string, JsonValue>>> = z
    .record(z.string().max(KEY_MAX), jsonBodySchema)
    .refine((entries) => Object.keys(entries).length <= ENTRIES_MAX, { message: "too many entries" })
