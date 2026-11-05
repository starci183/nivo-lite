import type { ListFilter, ListPage, ListQuery, ListShape, ListSource } from "@nivo-lite/agent-sdk/block"
import { unprovided } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition, PortProvider } from "@nivo-lite/agent-sdk/port"
import { waitsForOwner } from "../../rules/sales/order-confirm"
import { matchesQuery } from "../../rules/sales/search"
import { salesLeadStore, salesLeadsList, salesOrderStore, salesOrdersList, salesRights } from "./ports"
import type { LeadStore, OrderStore, RightsStore } from "./ports"
import type { LeadPatch, LeadRow, OrderPatch, OrderRow, StoreResult } from "./sales.types"

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

const updateIn = <T extends { readonly id: string; readonly version: string; readonly updatedAt: string }>(
    rows: Array<T>,
    id: string,
    expected: string,
    patch: Partial<T>,
    now: string,
): StoreResult<T> => {
    const index = rows.findIndex((row) => row.id === id)
    const current = rows[index]
    if (current === undefined) return { ok: false, reason: "missing" }
    if (current.version !== expected) return { ok: false, reason: "conflict" }
    const written: T = { ...current, ...patch, version: String(Number(current.version) + 1), updatedAt: now }
    rows[index] = written
    return { ok: true, row: written }
}

const leadStore = (state: MemoryState): LeadStore => ({
    get: (id) => Promise.resolve(state.leads.find((lead) => lead.id === id) ?? null),
    update: (id, expected, patch: LeadPatch) => Promise.resolve(updateIn(state.leads, id, expected, patch, state.now)),
    names: (ids) =>
        Promise.resolve(
            Object.fromEntries(
                state.leads.filter((lead) => ids.includes(lead.id)).map((lead) => [lead.id, lead.contactName]),
            ),
        ),
})

const orderStore = (state: MemoryState): OrderStore => ({
    get: (id) => Promise.resolve(state.orders.find((order) => order.id === id) ?? null),
    update: (id, expected, patch: OrderPatch) =>
        Promise.resolve(updateIn(state.orders, id, expected, patch, state.now)),
    ofLead: (leadId, limit) =>
        Promise.resolve(
            state.orders
                .filter((order) => order.leadId === leadId)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, limit),
        ),
    waiting: (thresholdVnd, limit) => {
        const rows = state.orders
            .filter((order) => waitsForOwner(order, thresholdVnd))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        return Promise.resolve({ rows: rows.slice(0, limit), total: rows.length })
    },
})

const rightsStore = (state: MemoryState): RightsStore => ({
    holds: (memberId) => Promise.resolve(memberId !== null && state.holders.includes(memberId)),
})

/**
 * A port provider over rows in memory: the leads and orders lists (search, enumerated filters, sort, paging, counts), the two
 * stores with version checks, and the rights. It stands in for the entity engine in specs and in the prototype data port.
 */
export const memoryProvider = (state: MemoryState): PortProvider => ({
    implementationOf: (port: PortDefinition<unknown>): unknown => {
        if (port.id === salesLeadsList.id) return memoryList(() => state.leads)
        if (port.id === salesOrdersList.id) return memoryList(() => state.orders)
        if (port.id === salesLeadStore.id) return leadStore(state)
        if (port.id === salesOrderStore.id) return orderStore(state)
        if (port.id === salesRights.id) return rightsStore(state)
        return unprovided(port)
    },
})
