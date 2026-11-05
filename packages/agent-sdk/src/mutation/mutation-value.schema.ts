import { z } from "zod"
import { body, keyText } from "../schema/bounded.schema"
import { entriesAtMost } from "../schema/entries"
import { jsonValue } from "../schema/json-value.schema"
import { RECORD_MAX } from "../schema/bounds"
import type { MutationValue, MutationValues } from "./mutation.types"

/** A version as the wire carries it: the decimal text of a bigint. */
export const versionToken: z.ZodType<string> = z
    .string()
    .max(19)
    .regex(/^\d{1,19}$/)

/** A record id on the wire. */
export const recordId: z.ZodType<string> = z.guid()

/** A value of the wire: a bounded text, a number, a boolean, null, or a bounded object (a `jsonb` field). */
export const mutationValue: z.ZodType<MutationValue> = z.union([
    body,
    z.number(),
    z.boolean(),
    z.null(),
    z.record(keyText, jsonValue).refine(entriesAtMost(RECORD_MAX)),
])

/** The values of one mutation: field name to value, at most 200 of them. */
export const mutationValues: z.ZodType<MutationValues> = z
    .record(keyText, mutationValue)
    .refine(entriesAtMost(RECORD_MAX))
