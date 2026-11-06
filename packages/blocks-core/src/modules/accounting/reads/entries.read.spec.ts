import type { ListQuery, ListSource, ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import type { PortProvider } from "@nivo-lite/agent-sdk/port"
import type { EntryRow } from "../accounting.types"
import { ENTRY_COUNTS, ENTRY_ROWS } from "../fixtures/accounting.fixtures"
import { ACCOUNTANT_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/accounting.memory"
import { ENTRIES_LIST } from "../ports"
import { ENTRIES_SHAPE, ENTRY_KINDS, entriesRead, entryCountsRead } from "./entries.read"

const NOT_RUNNABLE: ReadRunResult = { ok: false, problems: [] }

const harness = () => {
    const queries: Array<ListQuery> = []
    const source: ListSource<EntryRow> = {
        page: (_shape, query) => {
            queries.push(query)
            return Promise.resolve({ rows: ENTRY_ROWS, cursor: null })
        },
        counts: (_shape, _by, query) => {
            queries.push(query)
            return Promise.resolve(ENTRY_COUNTS.counts)
        },
    }
    const base = memoryProvider(memoryWorld())
    const provider: PortProvider = {
        implementationOf: (port) => (port.id === ENTRIES_LIST.id ? source : base.implementationOf(port)),
    }
    const execute = (read: ReadDefinition, raw: unknown): Promise<ReadRunResult> =>
        read.execute?.(provider, raw, ACCOUNTANT_CONTEXT) ?? Promise.resolve(NOT_RUNNABLE)
    return { queries, execute }
}

describe("accounting entries", () => {
    it("searches the note, filters by kind and sorts newest or largest first, 30 to a page", () => {
        expect(ENTRIES_SHAPE.search).toEqual({ fields: ["note"] })
        expect(ENTRIES_SHAPE.filters).toEqual({ kind: { field: "kind", op: "eq", of: ENTRY_KINDS } })
        expect(Object.keys(ENTRIES_SHAPE.sort)).toEqual(["recent", "amount"])
        expect(ENTRIES_SHAPE.page.size).toBe(30)
    })

    it("lists the first page with the default sort when nothing is asked", async () => {
        const { queries, execute } = harness()
        await expect(execute(entriesRead, {})).resolves.toEqual({ ok: true, data: { rows: ENTRY_ROWS, cursor: null } })
        expect(queries).toEqual([{ q: null, filters: {}, sort: "recent", cursor: null, size: 30 }])
    })

    it("passes the search, the kind and the sort to the source", async () => {
        const { queries, execute } = harness()
        await execute(entriesRead, { q: "  dinh ", kind: "income", sort: "amount" })
        expect(queries).toEqual([{ q: "dinh", filters: { kind: "income" }, sort: "amount", cursor: null, size: 30 }])
    })

    it("refuses a kind the list does not know", async () => {
        const { execute } = harness()
        await expect(execute(entriesRead, { kind: "expense" })).resolves.toMatchObject({ ok: false })
    })

    it("counts the entries per kind under the same search, whatever the kind chosen", async () => {
        const { queries, execute } = harness()
        await expect(execute(entryCountsRead, { q: "dinh" })).resolves.toEqual({ ok: true, data: ENTRY_COUNTS })
        expect(queries).toEqual([{ q: "dinh", filters: {}, sort: "recent", cursor: null, size: 30 }])
    })

    it("is a list of book entries and a counts read of the same kind filter", () => {
        expect(entriesRead.listing).toMatchObject({ kind: "list", defaultSort: "recent" })
        expect(entryCountsRead.listing).toEqual({ kind: "counts", of: "accounting.entries", by: "kind" })
        expect(entriesRead.permission).toBe("accounting.view")
    })
})
