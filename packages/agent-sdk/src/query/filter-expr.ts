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

/**
 * The depth of an expression: a leaf is 1; a wrapper (`and`, `or`, `not`, `has`) is one more than its deepest inner expression, and a
 * `has` without a `where` counts as a wrapper of a leaf (the trees the schema took when it was unrolled level by level).
 */
const depthOf = (expr: FilterExpr): number => {
    switch (expr.op) {
        case "and":
        case "or":
            return 1 + Math.max(...expr.of.map(depthOf))
        case "not":
            return 1 + depthOf(expr.of)
        case "has":
            return 1 + (expr.where === undefined ? 1 : depthOf(expr.where))
        default:
            return 1
    }
}

/** The tree of a filter expression, ONE recursive schema: its JSON Schema names itself once (`$defs` + `$ref`), never inlined per level. */
const tree: z.ZodType<FilterExpr> = z.lazy(() =>
    z.union([
        leaf,
        z.strictObject({ op: z.enum(["and", "or"]), of: z.array(tree).min(1).max(QUERY_BOUNDS.width) }),
        z.strictObject({ op: z.literal("not"), of: tree }),
        z.strictObject({ op: z.literal("has"), relation: identName, where: tree.exactOptional() }),
    ]),
)

/**
 * The zod schema of a filter expression: depth at most 6 (checked, not unrolled: an unrolled tree inlines each level three times, 3^5
 * copies, ~816k chars of JSON Schema in every model call that shows `nivo.tool.record.list`), width at most 32, every string and list
 * bounded.
 */
export const filterExprSchema: z.ZodType<FilterExpr> = tree.refine((expr) => depthOf(expr) <= QUERY_BOUNDS.depth, {
    message: `A filter is at most ${QUERY_BOUNDS.depth} levels deep.`,
})
