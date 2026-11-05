import { z } from "zod"
import { filterExprSchema } from "./filter-expr"
import { entityName, fieldName, identName } from "./name.schemas"
import { QUERY_BOUNDS, QUERY_LIMITS } from "./query-bounds"
import type { Aggregate, Query } from "./query.types"
import { entriesAtMost } from "../schema/entries"

export { filterExprSchema }

const direction = z.enum(["asc", "desc"])
const orderBy = z
    .array(z.tuple([fieldName, direction]))
    .min(1)
    .max(QUERY_LIMITS.order)
const selection = z.array(fieldName).min(1).max(QUERY_LIMITS.select)

const includeSpec = z.strictObject({
    relation: identName,
    select: selection,
    order: orderBy,
    latest: z.number().int().min(1).max(QUERY_BOUNDS.includeLatest),
})

/** The zod schema of a list query. */
export const querySchema: z.ZodType<Query> = z.strictObject({
    from: entityName,
    select: selection,
    join: z.record(identName, selection).refine(entriesAtMost(QUERY_LIMITS.join)).exactOptional(),
    include: z.array(includeSpec).max(QUERY_LIMITS.include).exactOptional(),
    where: filterExprSchema.exactOptional(),
    order: orderBy,
    page: z.strictObject({
        size: z.number().int().min(1).max(QUERY_BOUNDS.pageSize),
        after: z.string().max(QUERY_LIMITS.cursor).exactOptional(),
    }),
})

const measure = z.strictObject({
    kind: z.enum(["count", "sum", "min", "max", "avg"]),
    field: fieldName.exactOptional(),
    where: filterExprSchema.exactOptional(),
})

/** The zod schema of an aggregate query. */
export const aggregateSchema: z.ZodType<Aggregate> = z.strictObject({
    from: entityName,
    where: filterExprSchema.exactOptional(),
    groupBy: z.array(fieldName).max(QUERY_BOUNDS.groupBy).exactOptional(),
    measures: z.record(identName, measure).refine(entriesAtMost(QUERY_LIMITS.measures)),
    bucket: z.strictObject({ field: fieldName, unit: z.enum(["day", "week", "month"]) }).exactOptional(),
    limit: z.number().int().min(1).max(QUERY_BOUNDS.groups),
})
