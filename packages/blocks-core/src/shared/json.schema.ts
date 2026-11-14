import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { MAX_BODY, MAX_ENTRIES, MAX_ID } from "./bounds"

const scalar = z.union([z.string().max(MAX_BODY), z.number(), z.boolean(), z.null()])

/** A JSON value of bounded size: strings, lists and records all have an upper bound. */
export const boundedJson: z.ZodType<JsonValue, JsonValue> = z.lazy(() =>
    z.union([scalar, z.array(boundedJson).max(MAX_ENTRIES), boundedRecord]),
)

/** A record of JSON values of bounded size, for plain data a node carries without reading it. */
export const boundedRecord: z.ZodType<{ readonly [key: string]: JsonValue }, { readonly [key: string]: JsonValue }> = z
    .record(z.string().max(MAX_ID), boundedJson)
    .refine((entries) => Object.keys(entries).length <= MAX_ENTRIES)
