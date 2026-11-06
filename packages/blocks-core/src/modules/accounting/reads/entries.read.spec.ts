import type { ListQuery, ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { entriesSource, providerOf } from "../accounting.doubles"
import { ENTRY_COUNTS, ENTRY_ROWS } from "../fixtures/accounting.fixtures"
import { entriesSourcePort } from "../ports"
import { ENTRY_STATUSES } from "../../../rules/accounting/entry-status"
import { ENTRIES_SHAPE, ENTRY_KINDS, entriesRead, entryCountsRead, entryStatusCountsRead } from "./entries.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T12:00:00.000Z") }

const NOT_RUNNABLE: ReadRunResult = { ok: false, problems: [] }

const harness = () => {
    const queries: Array<ListQuery> = []
    const provider = providerOf([
        [
            entriesSourcePort,
            entriesSource({
                page: (_shape, query) => {
                    queries.push(query)
                    return Promise.resolve({ rows: ENTRY_ROWS, cursor: null })
                },
                counts: (_shape, _by, query) => {
                    queries.push(query)
                    return Promise.resolve(ENTRY_COUNTS.counts)
                },
            }),
        ],
    ])
    const execute = (read: ReadDefinition, raw: unknown): Promise<ReadRunResult> => {
        return read.execute?.(provider, raw, CONTEXT) ?? Promise.resolve(NOT_RUNNABLE)
    }
    return { queries, execute }
}

describe("accounting entries", () => {
    it("searches the note, filters by kind and sorts newest or largest first, 30 to a page", () => {
        expect(ENTRIES_SHAPE.search).toEqual({ fields: ["note"] })
        expect(ENTRIES_SHAPE.filters).toEqual({
            kind: { field: "kind", op: "eq", of: ENTRY_KINDS },
            status: { field: "status", op: "eq", of: ENTRY_STATUSES },
        })
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
        await expect(execute(entriesRead, { kind: "refund" })).resolves.toMatchObject({ ok: false })
    })

    it("counts the entries per kind under the same search, whatever the kind chosen", async () => {
        const { queries, execute } = harness()
        await expect(execute(entryCountsRead, { q: "dinh" })).resolves.toEqual({ ok: true, data: ENTRY_COUNTS })
        expect(queries).toEqual([{ q: "dinh", filters: {}, sort: "recent", cursor: null, size: 30 }])
    })

    it("counts the entries per status under the same search", async () => {
        const { queries, execute } = harness()
        await expect(execute(entryStatusCountsRead, { q: "dinh" })).resolves.toEqual({ ok: true, data: ENTRY_COUNTS })
        expect(queries).toEqual([{ q: "dinh", filters: {}, sort: "recent", cursor: null, size: 30 }])
        expect(entryStatusCountsRead.listing).toEqual({ kind: "counts", of: "accounting.entries", by: "status" })
    })

    it("is a list of book entries and a counts read of the same kind filter", () => {
        expect(entriesRead.listing).toMatchObject({ kind: "list", defaultSort: "recent" })
        expect(entryCountsRead.listing).toEqual({ kind: "counts", of: "accounting.entries", by: "kind" })
        expect(entriesRead.permission).toBe("accounting.view")
    })
})
