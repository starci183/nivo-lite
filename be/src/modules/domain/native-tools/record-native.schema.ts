import { z } from "zod"
import { filterExprSchema, QUERY_LIMITS } from "@nivo-lite/agent-sdk/query"
import { jsonBodySchema } from "@modules/platform/primitives"
import type { ToolJson } from "@modules/domain/tools"

/** The most records one `nivo.tool.record.list` answers: a page a model can read. */
export const RECORD_LIST_CAP = 50

/** The records one list answers when the call names no limit. */
export const RECORD_LIST_DEFAULT = 20

/**
 * The record type a call works on: a name an installed package declares with `defineEntity` (`<module>.<thing>`). Only its bounds are
 * checked here; whether an installed package declares it is the tool's to say (`type_unknown`).
 */
const recordType = z
    .string()
    .min(3)
    .max(QUERY_LIMITS.name)
    .describe("The record type, as its package declares it (`blocks-core.video.project`).")

/** A record id as an earlier answer gave it; one that is no record id of the workspace answers `not_found`. */
const recordId = z.string().min(1).max(64).describe("The record, by the `id` an earlier answer gave.")

/** The most fields one write carries: a record type declares far fewer; the bound only keeps a call finite. */
const FIELDS_MAX = 1000

/**
 * The declared fields a write carries, by field name: JSON values only. Their kinds, bounds, enums and jsonb shapes are the record
 * type's own declaration (`mutationProblems` of the SDK, the entity engine's own check): this schema holds no second copy of them.
 */
const fieldValues = z
    .record(z.string().min(1).max(QUERY_LIMITS.name), jsonBodySchema)
    .refine((values) => Object.keys(values).length <= FIELDS_MAX)

/** The most links one create carries: a record type declares far fewer; the bound only keeps a call finite. */
const LINKS_MAX = 50

/**
 * The toOne relations a new record is linked to, by relation name: each the id of a record of YOUR OWN. Which relations exist, which are
 * required and what they point at is the record type's own declaration (the same check the entity engine runs); this schema only bounds
 * the shape.
 */
const relationLinks = z
    .record(z.string().min(1).max(QUERY_LIMITS.name), recordId)
    .refine((links) => Object.keys(links).length <= LINKS_MAX)

/** One key of an order: a declared field and its direction. */
const orderKey = z.tuple([z.string().min(1).max(QUERY_LIMITS.name), z.enum(["asc", "desc"])])

/** The arguments of `nivo.tool.record.get`. */
export const RECORD_GET_SCHEMA = z.strictObject({ type: recordType, id: recordId })

/** The arguments of `nivo.tool.record.list`: the engine's declarative filter and order, a capped page, and the cursor of the next page. */
export const RECORD_LIST_SCHEMA = z.strictObject({
    type: recordType,
    where: filterExprSchema
        .optional()
        .describe(
            "A condition on the type's own fields (eq, ne, lt, lte, gt, gte, in, notIn, isNull, notNull, search, overlaps, and, or, not).",
        ),
    order: z
        .array(orderKey)
        .min(1)
        .max(QUERY_LIMITS.order - 1)
        .optional()
        .describe(
            "The order, by declared fields; the record id closes it. A declared index must serve the filter and the order.",
        ),
    limit: z
        .number()
        .int()
        .min(1)
        .max(RECORD_LIST_CAP)
        .optional()
        .describe(`The most records answered; ${RECORD_LIST_DEFAULT} when left out.`),
    cursor: z
        .string()
        .min(1)
        .max(QUERY_LIMITS.cursor)
        .optional()
        .describe("Only to page: the `next` an earlier answer of the same list gave."),
    fields: z
        .array(z.string().min(1).max(QUERY_LIMITS.name))
        .min(1)
        .max(QUERY_LIMITS.select)
        .optional()
        .describe("The fields answered; every declared field when left out."),
})

/** The arguments of `nivo.tool.record.create`. */
export const RECORD_CREATE_SCHEMA = z.strictObject({
    type: recordType,
    values: fieldValues.describe("The declared fields of the new record, by field name."),
    links: relationLinks
        .optional()
        .describe(
            "Only for a type that declares relations: the toOne relation name -> the `id` of one of your own records it points at (a relation the type marks required must be given).",
        ),
})

/** The arguments of `nivo.tool.record.update`. */
export const RECORD_UPDATE_SCHEMA = z.strictObject({
    type: recordType,
    id: recordId,
    patch: fieldValues.describe("The declared fields that change, by field name; the others stay as they are."),
    version: z
        .string()
        .min(1)
        .max(40)
        .optional()
        .describe(
            "Only to change the record as it was read: the `version` an earlier answer gave; `stale` when it changed since.",
        ),
})

/** The arguments of `nivo.tool.record.get`, as the tool reads them. */
export type RecordGetArgs = z.output<typeof RECORD_GET_SCHEMA>

/** The arguments of `nivo.tool.record.list`, as the tool reads them. */
export type RecordListArgs = z.output<typeof RECORD_LIST_SCHEMA>

/** The arguments of `nivo.tool.record.create`, as the tool reads them. */
export type RecordCreateArgs = z.output<typeof RECORD_CREATE_SCHEMA>

/** The arguments of `nivo.tool.record.update`, as the tool reads them. */
export type RecordUpdateArgs = z.output<typeof RECORD_UPDATE_SCHEMA>

/** The schemas the manifest announces, generated from the validators. */
export const RECORD_GET_INPUT_SCHEMA: ToolJson = z.toJSONSchema(RECORD_GET_SCHEMA, { io: "input" })
export const RECORD_LIST_INPUT_SCHEMA: ToolJson = z.toJSONSchema(RECORD_LIST_SCHEMA, { io: "input" })
export const RECORD_CREATE_INPUT_SCHEMA: ToolJson = z.toJSONSchema(RECORD_CREATE_SCHEMA, { io: "input" })
export const RECORD_UPDATE_INPUT_SCHEMA: ToolJson = z.toJSONSchema(RECORD_UPDATE_SCHEMA, { io: "input" })
