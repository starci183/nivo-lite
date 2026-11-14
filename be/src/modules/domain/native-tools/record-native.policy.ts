import type { EntityDefinition, IndexPart } from "@nivo-lite/agent-sdk/entity"
import type { EngineResult, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import {
    mutationProblems,
    type Mutation,
    type MutationLinks,
    type MutationProblem,
    type MutationValues,
} from "@nivo-lite/agent-sdk/mutation"
import {
    queryProblems,
    type FilterExpr,
    type OrderBy,
    type OrderKey,
    type Query,
    type QueryProblem,
} from "@nivo-lite/agent-sdk/query"
import { ToolsError, ToolsErrorCode, type RefusalClass } from "@modules/domain/tools"
import type { RecordRefusalReason, RecordVerb, RecordView } from "./record-native.contracts"
import { type RecordListArgs, RECORD_LIST_DEFAULT } from "./record-native.schema"

/** The key every record is ordered by last, so an order is total (keyset paging). */
const KEY = "id"

/** A record id: what the entity engine mints. Anything else names no record of the workspace. */
const RECORD_ID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu

/** The verbs of the record tools, by their name in the manifest. */
const VERB_BY_NAME: Readonly<Record<string, RecordVerb>> = { get: "get", list: "list", create: "create", update: "update" }

/**
 * What each refusal of the record tools IS (a TOTAL record): `business`, a fact about the records the node or its agent reads and goes
 * on from (`{ ok: false, refusal }`); `infrastructure`, what only the template or the app's wiring can cure: the step freezes and is
 * reported. When unsure: infrastructure.
 */
export const RECORD_REFUSAL_CLASS: Readonly<Record<RecordRefusalReason, RefusalClass>> = {
    type_unknown: "business",
    not_found: "business",
    invalid_value: "business",
    taken: "business",
    stale: "business",
    query_invalid: "business",
    query_not_indexed: "business",
    type_read_only: "infrastructure",
    not_served: "infrastructure",
}

/**
 * The refusal a record tool throws for an expected case, in the shape every native refusal has (`reason`, `refusalClass`): the gateway
 * turns it into the generic typed refusal. The failure that led to it, when there was one, rides as its cause.
 */
export const recordRefusal = (reason: RecordRefusalReason, cause?: unknown): ToolsError =>
    new ToolsError({
        code: ToolsErrorCode.NativeRefused,
        params: { reason, refusalClass: RECORD_REFUSAL_CLASS[reason] },
        ...(cause === undefined ? {} : { cause }),
    })

/** The verb of a record tool by its name in the manifest, or null for a name the record tools do not have. */
export const verbOf = (tool: string): RecordVerb | null => (Object.hasOwn(VERB_BY_NAME, tool) ? (VERB_BY_NAME[tool] ?? null) : null)

/** True for a text that can be a record id; any other text names no record (`not_found`). */
export const isRecordId = (id: string): boolean => RECORD_ID.test(id)

/** The insert of one record of the type, linked through the toOne relations it names (none when it names none). */
export const createOf = (type: string, values: MutationValues, links?: MutationLinks): Mutation =>
    links === undefined ? { op: "insert", entity: type, values } : { op: "insert", entity: type, values, links }

/**
 * The records a create's links point at, with the entity each relation targets as the type declares it (`relations[name].target`); a
 * relation the type does not declare is left out (the mutation check refuses it first). The caller reads each in the agent's scope: a
 * target that scope does not show is not the caller's own.
 */
export const linkTargetsOf = (
    definition: EntityDefinition,
    links: Readonly<Record<string, string>>,
): ReadonlyArray<{ readonly relation: string; readonly target: string; readonly id: string }> =>
    Object.entries(links).flatMap(([relation, id]) => {
        const declared = definition.relations?.[relation]
        return declared === undefined ? [] : [{ relation, target: declared.target, id }]
    })

/** The update of one record of the type, guarded by the version it was read at. */
export const updateOf = (type: string, id: string, expected: string, patch: MutationValues): Mutation => ({
    op: "update",
    entity: type,
    key: id,
    expected,
    values: patch,
})

/**
 * Why a write is refused before it runs, from the type's own declaration (`mutationProblems`, the check the entity engine itself runs
 * first: no second schema): a projection written by a node is `type_read_only`, a key that is no record id `not_found`, every other
 * problem (an unknown or system field, a value off its kind, bounds, enum or jsonb shape, a required field missing, nothing to change)
 * `invalid_value`; null when the write may run.
 */
export const writeRefusalOf = (definition: EntityDefinition, mutation: Mutation): RecordRefusalReason | null => {
    const [first]: ReadonlyArray<MutationProblem> = mutationProblems(mutation, [definition], "action")
    if (first === undefined) return null
    if (first.code === "MUTATION_PROJECTION_WRITE") return "type_read_only"
    if (first.code === "MUTATION_KEY_INVALID") return "not_found"
    return "invalid_value"
}

/**
 * The refusal of a write the engine answered without writing: a declared unique or no-overlap constraint held (`taken`), the version
 * moved (`stale`), the record is not in the workspace (`not_found`), a declared check or link refused it (`invalid_value`); null for a
 * write that happened.
 */
export const resultRefusalOf = (result: EngineResult): RecordRefusalReason | null => {
    if (result.ok) return null
    if (result.reason === "taken") return "taken"
    if (result.reason === "stale") return "stale"
    if (result.reason === "missing") return "not_found"
    return "invalid_value"
}

/** True for a filter that reaches into records of another type (`has` over a relation): a record tool reads its own type only. */
export const crossesType = (where: FilterExpr): boolean => {
    if (where.op === "has") return true
    if (where.op === "and" || where.op === "or") return where.of.some((part) => crossesType(part))
    if (where.op === "not") return crossesType(where.of)
    return false
}

/** One index part as an order key, or null for a part no order can name (a folded text, a jsonb key). */
const orderKeyOf = (part: IndexPart): OrderKey | null => {
    if (typeof part === "string") return [part, "asc"]
    return "desc" in part ? [part.desc, "desc"] : null
}

/** The order an index's columns give, when every column is a plain field and the last is the record id; null otherwise. */
const indexOrderOf = (on: ReadonlyArray<IndexPart>): OrderBy | null => {
    const keys = on.map((part) => orderKeyOf(part))
    if (keys.includes(null) || keys.at(-1)?.[0] !== KEY) return null
    return keys.filter((key): key is OrderKey => key !== null)
}

/** The orders the type's declared indexes give, in declaration order, then those of its unconditional unique constraints. */
const declaredOrdersOf = (definition: EntityDefinition): ReadonlyArray<OrderBy> => [
    ...(definition.indexes ?? []).map((index) => indexOrderOf(index.on)),
    ...(definition.constraints ?? []).map((constraint) =>
        constraint.kind === "unique" && constraint.where === undefined ? indexOrderOf([...constraint.on, KEY]) : null,
    ),
].filter((order): order is OrderBy => order !== null)

/** The order a call asked for, closed by the record id when it does not end with it (the direction of its last key). */
const closedOrderOf = (order: OrderBy): OrderBy => {
    const last = order.at(-1)
    return last === undefined || last[0] === KEY ? order : [...order, [KEY, last[1]]]
}

/** The query of a list call over the type, before its order is settled. */
const queryOf = (definition: EntityDefinition, args: RecordListArgs, order: OrderBy): Query => ({
    from: definition.name,
    select: args.fields ?? Object.keys(definition.fields),
    ...(args.where === undefined ? {} : { where: args.where }),
    order,
    page: {
        size: args.limit ?? RECORD_LIST_DEFAULT,
        ...(args.cursor === undefined ? {} : { after: args.cursor }),
    },
})

/** What a list call comes to: the query to run, or why it is refused. */
export type RecordListPlan = { readonly kind: "query"; readonly query: Query } | { readonly kind: "refused"; readonly reason: RecordRefusalReason }

/** The refusal of the first problem of a query: no declared index serving it is `query_not_indexed`, anything else `query_invalid`. */
const queryRefusalOf = (problems: ReadonlyArray<QueryProblem>): RecordRefusalReason | null => {
    const [first] = problems
    if (first === undefined) return null
    return problems.some((problem) => problem.code === "QUERY_NOT_INDEXED") ? "query_not_indexed" : "query_invalid"
}

/**
 * The query of a list call, checked against the type's own declaration (`queryProblems`, the check the entity engine itself runs first):
 * the type's own fields only (a `has` into another type is `query_invalid`), the call's order closed by the record id, or, when it names
 * none, the first order a declared index of the type serves for its filter; refused `query_not_indexed` when no declared index serves
 * it, `query_invalid` for any other problem.
 */
export const listPlanOf = (definition: EntityDefinition, args: RecordListArgs): RecordListPlan => {
    if (args.where !== undefined && crossesType(args.where)) return { kind: "refused", reason: "query_invalid" }
    const catalog: ReadonlyMap<string, EntityDefinition> = new Map([[definition.name, definition]])
    const asked: ReadonlyArray<OrderBy> =
        args.order === undefined ? declaredOrdersOf(definition) : [closedOrderOf(args.order)]
    const tried = asked.map((order) => queryOf(definition, args, order))
    const served = tried.find((query) => queryProblems(query, catalog).length === 0)
    if (served !== undefined) return { kind: "query", query: served }
    const shown = tried[0] ?? queryOf(definition, args, [[KEY, "asc"]])
    return { kind: "refused", reason: queryRefusalOf(queryProblems(shown, catalog)) ?? "query_not_indexed" }
}

/** A record as the record tools answer it. */
export const recordViewOf = (row: RecordRow): RecordView => ({
    id: row.id,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    values: row.data,
})
