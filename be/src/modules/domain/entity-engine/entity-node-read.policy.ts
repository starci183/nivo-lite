import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import type { RightScope } from "@nivo-lite/agent-sdk/rights"
import type { EntityDefinition, IndexDef, IndexPart } from "@nivo-lite/agent-sdk/entity"
import type { FilterExpr, OrderBy } from "@nivo-lite/agent-sdk/query"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { EntityNodeRow, EntityNodeTurn, NodeCondition, NodeReadPlan, TurnPath } from "./entity-node.contracts"

/** The most rows one node read answers (the engine's page ceiling). */
export const NODE_READ_MAX = 100

/** The rows one node read answers when the query names no limit. */
export const NODE_READ_DEFAULT = 50

/** The most pages a read scans when it keeps only the records linked to the turn's record (the filter language holds no toOne test). */
export const NODE_SCAN_PAGES = 10

/** The data kind of the conversation a turn serves: the host's own vocabulary (`NodeTurn.conversationId`). */
const CONVERSATION_KIND = "conversation"

/** Newest first, ending with `id` as keyset paging needs. */
const NEWEST_FIRST: OrderBy = [
    ["createdAt", "desc"],
    ["id", "desc"],
]

/**
 * Whether the fields a read pins by equality name one record: the `id`, or all the fields of a declared unique key. Such a read is a
 * single-row lookup, not a listing, and has no "newest" to choose.
 */
export const isLookup = (entity: EntityDefinition, pinned: ReadonlyArray<string>): boolean =>
    pinned.includes("id") ||
    (entity.constraints ?? []).some(
        // A partial unique key (its `where`) names one record only among the rows its predicate holds for, so it is a lookup only when
        // the pins make the predicate hold: a `notNull` of a pinned field (an equality to a value is never null).
        (constraint) =>
            constraint.kind === "unique" &&
            (constraint.where === undefined ||
                (constraint.where.op === "notNull" && pinned.includes(constraint.where.field))) &&
            constraint.on.every((field) => pinned.includes(field)),
    )

/** A lookup of one record: by its id, which a `key` index serves. */
const BY_ID: OrderBy = [["id", "asc"]]

/** A plain column of an index part, with its direction; null for a folded or a jsonb-key part, which no order names. */
const columnOf = (part: IndexPart): { readonly name: string; readonly desc: boolean } | null => {
    if (typeof part === "string") return { name: part, desc: false }
    return "desc" in part ? { name: part.desc, desc: true } : null
}

/** The btree indexes that serve the entity's lists: the declared ones and the index behind each unconditional unique key. */
const servingIndexesOf = (entity: EntityDefinition): ReadonlyArray<IndexDef> => [
    ...(entity.indexes ?? []),
    ...(entity.constraints ?? []).flatMap((constraint): ReadonlyArray<IndexDef> =>
        constraint.kind === "unique" && constraint.where === undefined
            ? [{ name: constraint.name, on: [...constraint.on, "id"] }]
            : [],
    ),
]

/** Whether a field of the entity is a moment: the engine's own creation and change times, or a declared `timestamptz` field. */
const isTimeOf = (entity: EntityDefinition, field: string): boolean =>
    field === "createdAt" || field === "updatedAt" || entity.fields[field]?.kind === "timestamptz"

/**
 * The newest-first order a declared index serves after the fields a read pins: the time column that follows the pinned fields in an
 * index (`createdAt` when one serves it, else the index's own: `sentAt` of a message, `occurredAt` of a credit, `updatedAt` of a
 * customer), then the id, both descending. Null when no index serves a newest-first read of these pins.
 */
export const newestOrderOf = (entity: EntityDefinition, pinned: ReadonlyArray<string>): OrderBy | null => {
    const wanted = [...new Set(pinned)]
    const fields = servingIndexesOf(entity).flatMap((index): ReadonlyArray<string> => {
        if (index.where !== undefined || (index.using !== undefined && index.using !== "btree")) return []
        const columns = index.on.map(columnOf)
        const head = columns.slice(0, wanted.length).map((column) => column?.name)
        const [time, last] = columns.slice(wanted.length, wanted.length + 2)
        const pinsFit = head.length === wanted.length && wanted.every((field) => head.includes(field))
        return pinsFit &&
            time !== null &&
            time !== undefined &&
            isTimeOf(entity, time.name) &&
            last?.name === "id" &&
            last.desc === time.desc
            ? [time.name]
            : []
    })
    const field = fields.includes("createdAt") ? "createdAt" : fields[0]
    return field === undefined
        ? null
        : [
              [field, "desc"],
              ["id", "desc"],
          ]
}

const SYSTEM_FIELDS: ReadonlySet<string> = new Set(["id", "version", "createdAt", "updatedAt"])

/** The most rows the query asks for, within the host's bounds. */
export const limitOf = (query: NodeQuery): number =>
    Math.min(NODE_READ_MAX, Math.max(1, Math.trunc(query.limit ?? NODE_READ_DEFAULT)))

/** The records a turn is about, in the order they are tried: its own subject, then the conversation it serves. */
const anchorsOf = (turn: EntityNodeTurn): ReadonlyArray<{ readonly kind: string; readonly id: string }> => [
    ...(turn.subject === null ? [] : [turn.subject]),
    ...(turn.conversationId === null ? [] : [{ kind: CONVERSATION_KIND, id: turn.conversationId }]),
]

/**
 * How a `turn` read reaches the turn's records: the first anchor whose data kind is the entity's own (that record), else the first whose
 * data kind a toOne relation of the entity targets (the records linked to it). Null when no anchor has a path: the read answers nothing.
 */
export const turnPathOf = (
    entity: EntityDefinition,
    kindOfEntity: (name: string) => string | undefined,
    turn: EntityNodeTurn,
): TurnPath | null => {
    const anchors = anchorsOf(turn)
    const own = anchors.find((anchor) => anchor.kind === entity.dataKind)
    if (own !== undefined) return { relation: null, id: own.id }
    const links = Object.entries(entity.relations ?? {}).filter(([, relation]) => relation.kind === "toOne")
    return (
        anchors.flatMap((anchor) =>
            links
                .filter(([, relation]) => kindOfEntity(relation.target) === anchor.kind)
                .map(([name]): TurnPath => ({ relation: name, id: anchor.id })),
        )[0] ?? null
    )
}

/** The equality filters of a node query, one `eq` per field. */
const equalities = (where: NodeQuery["where"]): ReadonlyArray<FilterExpr> =>
    Object.entries(where ?? {}).map(([field, value]): FilterExpr => ({ op: "eq", field, value }))

/** The declared fields among the fields asked: the system fields come with every record. */
const selectOf = (fields: ReadonlyArray<string>): ReadonlyArray<string> => [
    ...new Set(fields.filter((field) => !SYSTEM_FIELDS.has(field))),
]

/** One filter, or an `and` of several, or none. */
const conditionOf = (filters: ReadonlyArray<FilterExpr>): NodeCondition => {
    const [only, ...rest] = filters
    if (only === undefined) return {}
    return { where: rest.length === 0 ? only : { op: "and", of: filters } }
}

/**
 * The statement a node read runs. A `workspace` read lists the entity under the query's equalities; a `turn` read adds the turn's
 * record: the entity's own record by id, or the records linked to it, read through a join and kept when the joined record is the turn's.
 * Null when a `turn` read has no path to a record of the turn.
 */
export const nodeReadPlanOf = (
    entity: EntityDefinition,
    kindOfEntity: (name: string) => string | undefined,
    turn: EntityNodeTurn,
    query: NodeQuery,
    scope: RightScope,
): NodeReadPlan | null => {
    const path = scope === "turn" ? turnPathOf(entity, kindOfEntity, turn) : null
    if (scope === "turn" && path === null) return null
    const own: ReadonlyArray<FilterExpr> =
        path !== null && path.relation === null ? [{ op: "eq", field: "id", value: path.id }] : []
    const via = path?.relation ?? null
    const limit = limitOf(query)
    const condition = conditionOf([...equalities(query.where), ...own])
    const pinned = [...Object.keys(query.where ?? {}), ...(path !== null && path.relation === null ? ["id"] : [])]
    return {
        query: {
            from: entity.name,
            select: selectOf(query.fields),
            ...(via === null ? {} : { join: { [via]: [] } }),
            ...condition,
            order: isLookup(entity, pinned) ? BY_ID : (newestOrderOf(entity, pinned) ?? NEWEST_FIRST),
            page: { size: via === null ? limit : NODE_READ_MAX },
        },
        via,
        anchor: path?.id ?? "",
        limit,
    }
}

/** The row of a record cut to the fields asked: a system field from the record, a declared one from its data, else null. */
export const nodeRowOf = (record: RecordRow, fields: ReadonlyArray<string>): EntityNodeRow => {
    const system = new Map<string, string>([
        ["id", record.id],
        ["version", record.version],
        ["createdAt", record.createdAt],
        ["updatedAt", record.updatedAt],
    ])
    return Object.fromEntries(
        fields.map((field) => [
            field,
            system.get(field) ?? (Object.hasOwn(record.data, field) ? record.data[field] : null),
        ]),
    )
}
