import { z } from "zod"
import { KEY_MAX, LIST_MAX, TEXT_MAX } from "../schema/bounds"
import type { CatalogSnapshot } from "./catalog.types"

/** The most partitions, views or bases a catalog lists. */
const PARTITIONS_MAX = 2000

const name = z.string().max(KEY_MAX)
const sqlText = z.string().max(TEXT_MAX)

const indexSchema = z.strictObject({
    name,
    columns: z.array(sqlText).max(LIST_MAX),
    unique: z.boolean(),
    method: name,
    predicate: sqlText.nullable(),
})

const constraintSchema = z.strictObject({
    name,
    kind: z.enum(["primary", "unique", "check", "foreign", "exclude"]),
    definition: sqlText,
    validated: z.boolean(),
})

const policySchema = z.strictObject({
    name,
    roles: z.array(name).max(LIST_MAX),
    command: z.enum(["select", "insert", "update", "delete", "all"]),
    permissive: z.boolean(),
    qual: sqlText.nullable(),
    check: sqlText.nullable(),
})

const grantSchema = z.strictObject({ role: name, privileges: z.array(name).max(LIST_MAX) })

const baseSchema = z.strictObject({
    name,
    rlsEnabled: z.boolean(),
    rlsForced: z.boolean(),
    policies: z.array(policySchema).max(LIST_MAX),
    grants: z.array(grantSchema).max(LIST_MAX),
})

const partitionSchema = z.strictObject({
    name,
    bound: name,
    constraints: z.array(constraintSchema).max(PARTITIONS_MAX),
    indexes: z.array(indexSchema).max(PARTITIONS_MAX),
})

const viewSchema = z.strictObject({
    name,
    columns: z.array(z.strictObject({ name, type: name })).max(PARTITIONS_MAX),
})

/** The bounded parser of the jsonb `public.engine_catalog` returns (R305): unknown keys and oversized lists are refused. */
export const catalogSnapshotSchema: z.ZodType<CatalogSnapshot> = z.strictObject({
    extensions: z.array(name).max(LIST_MAX),
    bases: z.array(baseSchema).max(LIST_MAX),
    partitions: z.array(partitionSchema).max(PARTITIONS_MAX),
    views: z.array(viewSchema).max(PARTITIONS_MAX),
})
