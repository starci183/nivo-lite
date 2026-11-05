import { z } from "zod"
import { keyText } from "../schema/bounded.schema"
import { entriesAtMost } from "../schema/entries"
import { RECORD_MAX } from "../schema/bounds"
import type { Mutation } from "./mutation.types"
import { mutationValues, recordId, versionToken } from "./mutation-value.schema"

const links = z.record(keyText, recordId).refine(entriesAtMost(RECORD_MAX))

const insertSchema = z.strictObject({
    op: z.literal("insert"),
    entity: keyText,
    values: mutationValues,
    links: links.optional(),
})

const updateSchema = z.strictObject({
    op: z.literal("update"),
    entity: keyText,
    key: recordId,
    expected: versionToken,
    values: mutationValues,
})

const upsertSchema = z.strictObject({ op: z.literal("upsert"), entity: keyText, on: keyText, values: mutationValues })

const deleteSchema = z.strictObject({
    op: z.literal("delete"),
    entity: keyText,
    key: recordId,
    expected: versionToken.optional(),
})

const ensureSchema = z.strictObject({
    op: z.literal("ensure"),
    entity: keyText,
    match: keyText,
    values: mutationValues,
})

const linkSchema = z.strictObject({
    op: z.literal("link"),
    entity: keyText,
    key: recordId,
    relation: keyText,
    to: recordId,
})

const unlinkSchema = z.strictObject({
    op: z.literal("unlink"),
    entity: keyText,
    key: recordId,
    relation: keyText,
    to: recordId,
})

/** The wire form of a mutation tree: bounded, no unknown member. Whether it fits an entity is `mutationProblems`. */
export const mutationSchema: z.ZodType<Mutation> = z.discriminatedUnion("op", [
    insertSchema,
    updateSchema,
    upsertSchema,
    deleteSchema,
    ensureSchema,
    linkSchema,
    unlinkSchema,
])
