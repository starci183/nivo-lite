import { z } from "zod"
import { SdkDefinitionError } from "../block/definition-error"
import type { ListShape } from "../block/list.types"
import { countsRead, listQueryOf, listRead } from "./declaration-list"
import { CONTEXT, LEADS, LEADS_PORT, LEADS_SHAPE, LEAD_COUNTS, leadsProvider } from "./declaration.fixture"
import type { SourceCalls } from "./declaration.fixture"

const BASE = {
    id: "sales.leads",
    dataKind: "lead",
    permission: "sales.view",
    fields: ["id"],
    source: LEADS_PORT,
} as const
const BARE: ListShape = { sort: { recent: [["a", "asc"]] }, page: { size: 5 }, row: { id: "id", title: "t" } }
const callsOf = (): SourceCalls => ({ pages: [], counts: [] })

/** The error a call throws. */
function captured(call: () => unknown): unknown {
    try {
        call()
    } catch (error) {
        return error
    }
    return undefined
}

describe("listRead", () => {
    it("is a list read with its rows at the path rows and its listing", () => {
        expect(LEADS).toMatchObject({
            entry: "read",
            id: "sales.leads",
            operation: "sales.leads",
            shape: "list",
            dataKind: "lead",
            paths: { rows: "list" },
            fields: ["id", "name"],
            permission: "sales.view",
            ports: { source: LEADS_PORT },
            listing: { kind: "list", shape: LEADS_SHAPE, defaultSort: "recent", source: LEADS_PORT },
        })
    })

    it("derives q, sort, cursor and one optional enum per filter with all", () => {
        expect(Object.keys(LEADS.variables.shape)).toEqual(["q", "sort", "cursor", "stage", "stock"])
        const accepted = LEADS.variables.safeParse({ q: "an", sort: "name", cursor: "c", stage: "all", stock: "low" })
        expect(accepted.success).toBe(true)
        expect(LEADS.variables.safeParse({}).success).toBe(true)
        expect(LEADS.variables.safeParse({ stage: "lost" }).success).toBe(false)
        expect(LEADS.variables.safeParse({ stock: "new" }).success).toBe(false)
        expect(LEADS.variables.safeParse({ sort: "random" }).success).toBe(false)
        expect(LEADS.variables.safeParse({ q: "x".repeat(201) }).success).toBe(false)
    })

    it("takes any value for an open filter and still tells the enum filters apart", () => {
        const open: ListShape = {
            sort: { recent: [["a", "asc"]] },
            page: { size: 5 },
            row: { id: "id", title: "t" },
            filters: {
                tier: { field: "tierKey", op: "eq", of: ["gold"], open: true },
                stage: { field: "stage", op: "eq", of: ["won"] },
            },
        }
        const read = listRead({ ...BASE, list: open })
        expect(read.variables.safeParse({ tier: "renamed-tier" }).success).toBe(true)
        expect(read.variables.safeParse({ tier: "all" }).success).toBe(true)
        expect(read.variables.safeParse({ tier: "" }).success).toBe(false)
        expect(read.variables.safeParse({ tier: "x".repeat(300) }).success).toBe(false)
        expect(read.variables.safeParse({ stage: "other" }).success).toBe(false)
    })

    it("keeps extra variables next to the derived ones", () => {
        const read = listRead({ ...BASE, list: LEADS_SHAPE, variables: z.object({ ownerId: z.string().max(40) }) })
        expect(Object.keys(read.variables.shape)).toEqual(["ownerId", "q", "sort", "cursor", "stage", "stock"])
    })

    it("accepts a list without search or filters", () => {
        expect(Object.keys(listRead({ ...BASE, list: BARE }).variables.shape)).toEqual(["q", "sort", "cursor"])
    })

    it("runs: asks the source for a page of the parsed query and returns it", async () => {
        const calls = callsOf()
        const result = await LEADS.execute?.(
            leadsProvider(calls),
            { q: "  an  ", stage: "new", stock: "all", sort: "name", cursor: "c1" },
            CONTEXT,
        )
        expect(result).toEqual({ ok: true, data: { rows: [{ id: "l1", name: "An" }], cursor: "next" } })
        expect(calls.pages).toEqual([{ q: "an", filters: { stage: "new" }, sort: "name", cursor: "c1", size: 30 }])
    })

    it("runs with the defaults when the variables are empty", async () => {
        const calls = callsOf()
        await LEADS.execute?.(leadsProvider(calls), {}, CONTEXT)
        expect(calls.pages).toEqual([{ q: null, filters: {}, sort: "recent", cursor: null, size: 30 }])
    })

    it("refuses a variable the read does not declare, without calling the source", async () => {
        const calls = callsOf()
        const result = await LEADS.execute?.(leadsProvider(calls), { workspaceId: "other" }, CONTEXT)
        expect(result).toEqual({ ok: false, problems: [{ code: "INPUT_UNKNOWN_KEY", at: "workspaceId" }] })
        expect(calls.pages).toEqual([])
    })

    it.each<[string, ListShape, ReadonlyArray<string>]>([
        ["no sort", { ...LEADS_SHAPE, sort: {} }, []],
        ["a zero page", { ...LEADS_SHAPE, page: { size: 0 } }, []],
        ["a fractional page", { ...LEADS_SHAPE, page: { size: 2.5 } }, []],
        [
            "a filter named like a derived variable",
            { ...LEADS_SHAPE, filters: { q: { field: "x", op: "eq", of: ["a"] } } },
            [],
        ],
        ["a filter without values", { ...LEADS_SHAPE, filters: { stage: { field: "x", op: "in", of: [] } } }, []],
        ["a filter without cases", { ...LEADS_SHAPE, filters: { stock: { cases: {} } } }, []],
        ["an extra variable named like a derived one", LEADS_SHAPE, ["cursor"]],
        ["an extra variable named like a filter", LEADS_SHAPE, ["stage"]],
    ])("refuses %s", (_name, list, extra) => {
        const variables = z.object(Object.fromEntries(extra.map((name) => [name, z.string().max(5).optional()])))
        const error = captured(() => listRead({ ...BASE, list, variables }))
        expect(error).toBeInstanceOf(SdkDefinitionError)
        expect(error).toMatchObject({ code: "LIST_SHAPE_INVALID", at: "sales.leads" })
    })
})

describe("listQueryOf", () => {
    it("trims the search, drops an all filter and an empty search, and takes the default sort", () => {
        expect(listQueryOf(LEADS_SHAPE, "recent", { q: "   ", stage: "all", stock: "out" })).toEqual({
            q: null,
            filters: { stock: "out" },
            sort: "recent",
            cursor: null,
            size: 30,
        })
    })

    it("ignores values that are not text", () => {
        expect(listQueryOf(LEADS_SHAPE, "recent", { q: 4, stage: 1, sort: 2, cursor: 3 })).toEqual({
            q: null,
            filters: {},
            sort: "recent",
            cursor: null,
            size: 30,
        })
    })

    it("works for a list with no filters", () => {
        expect(listQueryOf(BARE, "recent", { q: "x" })).toMatchObject({ q: "x", filters: {}, size: 5 })
    })
})

describe("countsRead", () => {
    it("is a record read of counts and total under the list search and other filters, never the counted filter", () => {
        expect(LEAD_COUNTS).toMatchObject({
            entry: "read",
            id: "sales.lead-counts",
            shape: "record",
            dataKind: "counts",
            fields: ["counts", "total"],
            paths: { counts: "record" },
            permission: "sales.view",
            listing: { kind: "counts", of: "sales.leads", by: "stage" },
        })
        expect(Object.keys(LEAD_COUNTS.variables.shape)).toEqual(["q", "stock"])
    })

    it("runs: counts under the same search and other filters, and totals them", async () => {
        const calls = callsOf()
        const result = await LEAD_COUNTS.execute?.(leadsProvider(calls), { q: "an", stock: "low" }, CONTEXT)
        expect(result).toEqual({ ok: true, data: { counts: { new: 2, won: 3 }, total: 5 } })
        expect(calls.counts).toEqual([
            { by: "stage", query: { q: "an", filters: { stock: "low" }, sort: "recent", cursor: null, size: 30 } },
        ])
    })

    it("refuses the counted filter and the cursor as variables", async () => {
        const result = await LEAD_COUNTS.execute?.(leadsProvider(callsOf()), { stage: "new", cursor: "c" }, CONTEXT)
        expect(result).toEqual({
            ok: false,
            problems: [
                { code: "INPUT_UNKNOWN_KEY", at: "stage" },
                { code: "INPUT_UNKNOWN_KEY", at: "cursor" },
            ],
        })
    })

    it("takes its own permission when given", () => {
        const counts = countsRead({ id: "sales.lead-counts", of: LEADS, by: "stock", permission: "sales.manage" })
        expect(counts.permission).toBe("sales.manage")
    })

    it("refuses a filter the list does not have", () => {
        const error = captured(() => countsRead({ id: "sales.lead-counts", of: LEADS, by: "owner" }))
        expect(error).toMatchObject({ code: "COUNTS_BY_UNKNOWN", at: "sales.lead-counts" })
    })

    it("refuses any filter of a list that has none", () => {
        const bare = listRead({ ...BASE, id: "sales.bare", list: BARE })
        expect(captured(() => countsRead({ id: "sales.bare-counts", of: bare, by: "stage" }))).toMatchObject({
            code: "COUNTS_BY_UNKNOWN",
        })
    })
})
