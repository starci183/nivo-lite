import type { ListFilter, ListPage, ListQuery, ListShape, ListSource } from "@nivo-lite/agent-sdk/block"
import type {
    AggregateRow,
    EngineResult,
    EntityApi,
    EntityQuery,
    JoinedRecord,
    ListPage as EnginePage,
    PageRow,
    RecordRow,
} from "@nivo-lite/agent-sdk/entity/port"
import { unprovided } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition, PortProvider } from "@nivo-lite/agent-sdk/port"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { EntityCatalog, FilterExpr, OrderBy } from "@nivo-lite/agent-sdk/query"
import { FLOW_F_ENTITIES } from "../../entities/flow-f.entities"
import { matchesQuery } from "../../rules/sales/search"
import type { RightsDirectory } from "../platform/platform.types"
import { rightsPort } from "../platform/ports"
import { salesLeads, salesLeadsList, salesOrders, salesOrdersList } from "./ports"
import { leadRowOf, orderRowOf } from "./sales-records"
import type { LeadRow, OrderRow } from "./sales.types"

/** What the in-memory provider holds: the rows, the members who hold the owner's right and the clock. */
export interface MemoryState {
    /** The leads; updates replace the entries. */
    readonly leads: Array<LeadRow>
    /** The orders; updates replace the entries. */
    readonly orders: Array<OrderRow>
    /** The ids of the members who hold every permission; any other member holds none. */
    readonly holders: ReadonlyArray<string>
    /** The instant an update stamps on a row, ISO text. */
    readonly now: string
}

/** A filter that names one field and the values it takes. */
interface Enumerated {
    /** The row field. */
    readonly field: string
    /** The values the filter takes. */
    readonly of: ReadonlyArray<string>
}

/** The filter as an enumerated one; a filter of named cases is not served by the memory source and narrows nothing. */
const enumeratedOf = (filter: ListFilter | undefined): Enumerated | null =>
    filter !== undefined && "field" in filter ? { field: filter.field, of: filter.of } : null

const valueOf = (row: object, field: string): unknown => Reflect.get(row, field)

const textOf = (row: object, field: string): string | null => {
    const value = valueOf(row, field)
    return typeof value === "string" ? value : null
}

const compare = (left: unknown, right: unknown): number =>
    typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right))

const rowsFor = <T extends object>(
    rows: ReadonlyArray<T>,
    shape: ListShape,
    query: ListQuery,
    skip: string | null,
): ReadonlyArray<T> =>
    rows.filter((row) => {
        const fields = shape.search?.fields ?? []
        if (
            !matchesQuery(
                query.q,
                fields.map((field) => textOf(row, field)),
            )
        )
            return false
        return Object.entries(query.filters).every(([name, chosen]) => {
            const filter = enumeratedOf(shape.filters?.[name])
            return name === skip || filter === null || valueOf(row, filter.field) === chosen
        })
    })

const memoryList = <T extends object>(rows: () => ReadonlyArray<T>): ListSource<T> => ({
    page: (shape, query): Promise<ListPage<T>> => {
        const keys = shape.sort[query.sort] ?? []
        const sorted = [...rowsFor(rows(), shape, query, null)].sort((a, b) => {
            for (const [field, direction] of keys) {
                const order = compare(valueOf(a, field), valueOf(b, field))
                if (order !== 0) return direction === "asc" ? order : -order
            }
            return 0
        })
        const start = query.cursor === null ? 0 : Number(query.cursor)
        const end = start + query.size
        return Promise.resolve({ rows: sorted.slice(start, end), cursor: end < sorted.length ? String(end) : null })
    },
    counts: (shape, by, query) => {
        const filter = enumeratedOf(shape.filters?.[by])
        if (filter === null) return Promise.resolve({})
        const found = rowsFor(rows(), shape, query, by)
        return Promise.resolve(
            Object.fromEntries(
                filter.of.map((name) => [name, found.filter((row) => valueOf(row, filter.field) === name).length]),
            ),
        )
    },
})

/** The entities the fake engine knows, the way the planner checks a query against them. */
const CATALOG: EntityCatalog = new Map(FLOW_F_ENTITIES.map((entity) => [entity.name, entity]))

/** The record columns, which are not keys of `data`. */
const COLUMNS: ReadonlySet<string> = new Set(["id", "version", "createdAt", "updatedAt"])

/** What the fake engine does not do. */
const unsupported = (): Promise<never> => Promise.reject(new Error("The fake engine does not run this call."))

/** The refusal of a condition the fake engine does not run. */
const unrun = (where: FilterExpr | undefined): Promise<never> =>
    Promise.reject(new Error(`The fake engine does not run the condition ${JSON.stringify(where)}.`))

/** The record the fake engine holds for a row: the system fields are columns, every other key is a declared field. */
const recordOf = (row: object): RecordRow => ({
    id: String(valueOf(row, "id")),
    workspaceId: "w1",
    version: String(valueOf(row, "version")),
    createdAt: String(valueOf(row, "createdAt")),
    updatedAt: String(valueOf(row, "updatedAt")),
    data: Object.fromEntries(Object.entries(row).filter(([key]) => !COLUMNS.has(key))),
})

/** The value of a field of a record: a system field, else a declared one. */
const fieldOf = (record: RecordRow, field: string): unknown => {
    if (field === "id") return record.id
    if (field === "createdAt") return record.createdAt
    if (field === "updatedAt") return record.updatedAt
    return record.data[field]
}

/** Whether a record matches a condition; null when the condition is one the fake does not run (it knows `eq`, `gte`, `isNull`, `and` and `or`). */
const matches = (record: RecordRow, where: FilterExpr | undefined): boolean | null => {
    if (where === undefined) return true
    if (where.op === "and" || where.op === "or") {
        const parts = where.of.map((part) => matches(record, part))
        if (parts.includes(null)) return null
        return where.op === "and" ? parts.every(Boolean) : parts.some(Boolean)
    }
    if (where.op === "eq") return fieldOf(record, where.field) === where.value
    if (where.op === "gte") {
        const value = fieldOf(record, where.field)
        return typeof value === "number" && typeof where.value === "number" && value >= where.value
    }
    if (where.op === "isNull") {
        const value = fieldOf(record, where.field)
        return value === null || value === undefined
    }
    return null
}

/** The records of a table that match a condition; null when the condition is one the fake does not run. */
const matching = (table: Table, where: FilterExpr | undefined): ReadonlyArray<RecordRow> | null => {
    const records = table.records()
    const verdicts = records.map((record) => matches(record, where))
    return verdicts.includes(null) ? null : records.filter((_record, index) => verdicts[index] === true)
}

/** The comparison of two records under an order. */
const compareBy =
    (order: OrderBy) =>
    (a: RecordRow, b: RecordRow): number =>
        order.reduce((decided, [field, direction]) => {
            if (decided !== 0) return decided
            const sign = compare(fieldOf(a, field), fieldOf(b, field))
            return direction === "asc" ? sign : -sign
        }, 0)

/** The fields of a record of data limited to the selected ones. */
const pick = (data: Readonly<Record<string, unknown>>, select: ReadonlyArray<string>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(data).filter(([name]) => select.includes(name)))

/** One table of the fake engine: the rows of an entity, how a record is read back as a row, and the records a relation joins. */
interface Table {
    /** The entity the table holds. */
    readonly entity: string
    /** The rows as records. */
    readonly records: () => ReadonlyArray<RecordRow>
    /** Replaces the row at an index with what a record holds; false when its fields are not those of the entity. */
    readonly replace: (index: number, record: RecordRow) => boolean
    /** The instant a write stamps, ISO text. */
    readonly now: string
    /** The records a toOne relation joins, by relation name; the id is the field named `<relation>Id`. */
    readonly joins: Readonly<Record<string, () => ReadonlyArray<RecordRow>>>
}

/** The record a toOne relation of a record joins, with the selected fields; null when it joins none. */
const joinedOf = (
    table: Table,
    record: RecordRow,
    relation: string,
    select: ReadonlyArray<string>,
): JoinedRecord | null => {
    const target = table.joins[relation]?.().find((candidate) => candidate.id === record.data[`${relation}Id`])
    return target === undefined ? null : { id: target.id, data: pick(target.data, select) }
}

/** One page of the records found over a table. */
const listed = (table: Table, query: EntityQuery, records: ReadonlyArray<RecordRow>): EnginePage => {
    const found = records.toSorted(compareBy(query.order))
    const from = query.page.after === undefined ? 0 : Number(query.page.after)
    const rows = found.slice(from, from + query.page.size).map((record): PageRow => ({
        row: { ...record, data: pick(record.data, query.select) },
        joined: Object.fromEntries(
            Object.entries(query.join ?? {}).map(([relation, select]) => [
                relation,
                joinedOf(table, record, relation, select),
            ]),
        ),
        position: [],
        included: {},
    }))
    return { rows, next: from + query.page.size < found.length ? String(from + query.page.size) : null }
}

/** Sets fields of a record whose version is the expected one; the row is replaced by what the fields make of it. */
const updated = (
    table: Table,
    key: string,
    expected: string,
    values: Readonly<Record<string, unknown>>,
): EngineResult => {
    const index = table.records().findIndex((record) => record.id === key)
    const current = table.records()[index]
    if (current === undefined) return { ok: false, reason: "missing" }
    if (current.version !== expected) return { ok: false, reason: "stale" }
    const next: RecordRow = {
        ...current,
        version: String(Number(current.version) + 1),
        updatedAt: table.now,
        data: { ...current.data, ...values },
    }
    if (!table.replace(index, next)) return { ok: false, reason: "invalid" }
    return { ok: true, row: next, version: next.version }
}

/** The data port of one entity over a table of the fake engine: get, list, aggregate (a count) and update, the calls the module makes. */
const entityApi = (table: Table): EntityApi => ({
    get: (id) => Promise.resolve(table.records().find((record) => record.id === id) ?? null),
    list: (query) => {
        const problems = queryProblems({ from: table.entity, ...query }, CATALOG).map((problem) => problem.code)
        if (problems.length > 0)
            return Promise.reject(new Error(`The planner refuses the query: ${problems.join(",")}`))
        const found = matching(table, query.where)
        return found === null ? unrun(query.where) : Promise.resolve(listed(table, query, found))
    },
    aggregate: (aggregate): Promise<ReadonlyArray<AggregateRow>> => {
        const found = matching(table, aggregate.where)
        return found === null
            ? unrun(aggregate.where)
            : Promise.resolve([{ groups: {}, measures: { count: found.length } }])
    },
    update: (key, expected, values) => Promise.resolve(updated(table, key, expected, values)),
    insert: unsupported,
    upsert: unsupported,
    ensure: unsupported,
    delete: unsupported,
    link: unsupported,
    unlink: unsupported,
})

const rightsDirectory = (state: MemoryState): RightsDirectory => ({
    holds: (memberId) => Promise.resolve(memberId !== null && state.holders.includes(memberId)),
})

/**
 * A port provider over rows in memory: the leads and orders lists (search, enumerated filters, sort, paging, counts), the two entity
 * ports (get, list with the order's customer joined, the count of an aggregate, version-checked update), and the rights. It stands in
 * for the entity engine in specs and in the prototype data port.
 */
export const memoryProvider = (state: MemoryState): PortProvider => {
    const leads: Table = {
        entity: "sales.lead",
        records: () => state.leads.map(recordOf),
        replace: (index, record) => {
            const row = leadRowOf(record)
            if (row !== null) state.leads[index] = row
            return row !== null
        },
        now: state.now,
        joins: {},
    }
    const orders: Table = {
        entity: "sales.order",
        records: () => state.orders.map(recordOf),
        replace: (index, record) => {
            const row = orderRowOf(record)
            if (row !== null) state.orders[index] = row
            return row !== null
        },
        now: state.now,
        joins: { lead: leads.records },
    }
    return {
        implementationOf: (port: PortDefinition<unknown>): unknown => {
            if (port.id === salesLeadsList.id) return memoryList(() => state.leads)
            if (port.id === salesOrdersList.id) return memoryList(() => state.orders)
            if (port.id === salesLeads.id) return entityApi(leads)
            if (port.id === salesOrders.id) return entityApi(orders)
            if (port.id === rightsPort.id) return rightsDirectory(state)
            return unprovided(port)
        },
    }
}
