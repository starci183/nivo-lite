import { z } from "zod"
import { fieldName, identName } from "./name.schemas"
import { QUERY_BOUNDS, QUERY_LIMITS } from "./query-bounds"
import type { FilterExpr } from "./query.types"

const scalar = z.union([z.string().max(QUERY_LIMITS.scalarText), z.number(), z.boolean(), z.null()])
const timeText = z.string().min(1).max(QUERY_LIMITS.name)

const compare = z
    .strictObject({
        op: z.enum(["eq", "ne", "lt", "lte", "gt", "gte"]),
        field: fieldName,
        value: scalar.exactOptional(),
        ref: fieldName.exactOptional(),
    })
    .refine((expr) => (expr.value === undefined) !== (expr.ref === undefined))

const membership = z.strictObject({
    op: z.enum(["in", "notIn"]),
    field: fieldName,
    values: z.array(scalar).max(QUERY_BOUNDS.inValues),
})

const nullCheck = z.strictObject({ op: z.enum(["isNull", "notNull"]), field: fieldName })

const search = z.strictObject({
    op: z.literal("search"),
    fields: z.array(fieldName).min(1).max(QUERY_LIMITS.searchFields),
    text: z.string().max(QUERY_BOUNDS.searchText),
})

const overlaps = z.strictObject({
    op: z.literal("overlaps"),
    range: z.tuple([fieldName, fieldName]),
    from: timeText,
    to: timeText,
})

const leaf: z.ZodType<FilterExpr> = z.union([compare, membership, nullCheck, search, overlaps])

/** The expressions that wrap another one: one more level of depth. */
const levelOf = (inner: z.ZodType<FilterExpr>): z.ZodType<FilterExpr> =>
    z.union([
        leaf,
        z.strictObject({ op: z.enum(["and", "or"]), of: z.array(inner).min(1).max(QUERY_BOUNDS.width) }),
        z.strictObject({ op: z.literal("not"), of: inner }),
        z.strictObject({ op: z.literal("has"), relation: identName, where: inner.exactOptional() }),
    ])

/** The zod schema of a filter expression: depth at most 6 by construction, width at most 32, every string and list bounded. */
export const filterExprSchema: z.ZodType<FilterExpr> = Array.from({ length: QUERY_BOUNDS.depth - 1 }).reduce<
    z.ZodType<FilterExpr>
>((inner) => levelOf(inner), leaf)
