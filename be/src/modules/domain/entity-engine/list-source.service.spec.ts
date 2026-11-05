import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { countsOf, cursorScopeOf, listQueryOf } from "@nivo-lite/agent-sdk/query"
import type { ListQuery, ListShape } from "@nivo-lite/agent-sdk/query"
import { EntityEngineService } from "./entity-engine.service"
import { ListSourceService } from "./list-source.service"
import { mintScopedTx } from "./policies/scoped-tx.policy"

const WS = "11111111-1111-4111-8111-111111111111"
const TX = mintScopedTx({ manager: mockEntityManager(), workspaceId: WS })
const AT = "2026-11-05T10:00:00.000Z"

const LEAD: EntityDefinition = {
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    fields: {
        contactName: { kind: "text", nullable: false, maxLength: 200 },
        stage: { kind: "enum", nullable: false, of: ["new", "won"] },
        amount: { kind: "int", nullable: true },
    },
}

const SHAPE: ListShape = {
    search: { fields: ["contactName"] },
    filters: {
        stage: { field: "stage", op: "eq", of: ["new", "won"] },
        size: {
            cases: {
                small: { field: "amount", op: "lt", value: 5 },
                large: { field: "amount", op: "gte", value: 5 },
            },
        },
    },
    sort: { recent: [["updatedAt", "desc"]] },
    page: { size: 20 },
    row: { id: "id", title: "contactName" },
}

const QUERY: ListQuery = { q: "an", filters: { stage: "won" }, sort: "recent", cursor: null, size: 20 }

const ROW = { id: "r-1", workspaceId: WS, version: "1", createdAt: AT, updatedAt: AT, data: { contactName: "An" } }

const build = async () => {
    const engine = mock<EntityEngineService>()
    engine.definition.mockReturnValue(LEAD)
    const moduleRef = await Test.createTestingModule({
        providers: [ListSourceService, { provide: EntityEngineService, useValue: engine }],
    }).compile()
    return { source: moduleRef.get(ListSourceService), engine }
}

describe("ListSourceService", () => {
    describe("page", () => {
        it("runs the query tree of the shape and variables with a cursor bound to the read, the search, the filters and the sort", async () => {
            const { source, engine } = await build()
            engine.list.mockResolvedValue({
                rows: [{ row: ROW, joined: {}, position: ["a"], included: {} }],
                next: "next-cursor",
            })

            const page = await source.page(TX, {
                read: "sales.leads",
                entity: "sales.lead",
                shape: SHAPE,
                query: QUERY,
            })

            expect(page).toEqual({ rows: [ROW], next: "next-cursor" })
            expect(engine.list).toHaveBeenCalledWith(
                TX,
                listQueryOf(LEAD, SHAPE, QUERY),
                cursorScopeOf("sales.leads", { stage: "won", $q: "an" }, "recent"),
            )
        })

        it("selects the further fields the caller asks for and scopes a list with no search text", async () => {
            const { source, engine } = await build()
            engine.list.mockResolvedValue({ rows: [], next: null })
            const query: ListQuery = { ...QUERY, q: null }

            const page = await source.page(TX, {
                read: "sales.leads",
                entity: "sales.lead",
                shape: SHAPE,
                query,
                select: ["amount"],
            })

            expect(page).toEqual({ rows: [], next: null })
            expect(engine.list).toHaveBeenCalledWith(
                TX,
                listQueryOf(LEAD, SHAPE, query, { select: ["amount"] }),
                cursorScopeOf("sales.leads", { stage: "won", $q: "" }, "recent"),
            )
        })
    })

    describe("counts", () => {
        it("counts the records of each value of a filter with the same search and the other filters", async () => {
            const { source, engine } = await build()
            engine.aggregate.mockResolvedValue([
                { groups: { stage: "new" }, measures: { count: 3 } },
                { groups: { stage: null }, measures: { count: "many" } },
            ])

            const counts = await source.counts(TX, { entity: "sales.lead", shape: SHAPE, by: "stage", query: QUERY })

            expect(counts).toEqual({ new: 3, "": 0 })
            expect(engine.aggregate).toHaveBeenCalledWith(TX, countsOf(LEAD, SHAPE, "stage", QUERY))
        })

        it("counts the records of each named case of a filter", async () => {
            const { source, engine } = await build()
            engine.aggregate.mockResolvedValue([{ groups: {}, measures: { small: 2, large: "7", odd: null } }])

            const counts = await source.counts(TX, { entity: "sales.lead", shape: SHAPE, by: "size", query: QUERY })

            expect(counts).toEqual({ small: 2, large: 7, odd: 0 })
            expect(engine.aggregate).toHaveBeenCalledWith(TX, countsOf(LEAD, SHAPE, "size", QUERY))
        })
    })
})
