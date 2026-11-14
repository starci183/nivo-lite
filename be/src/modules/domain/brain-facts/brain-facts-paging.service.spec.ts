import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import { Test } from "@nestjs/testing"
import { mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BrainFactsPagingService, cursorOf, positionOf } from "./brain-facts-paging.service"
import { SEARCH_COMMISSION_VI } from "@tests/fixtures/i18n/brain-facts-spec.messages"

const AT = "2026-11-11 10:00:00.123456+00"
const ID = "11111111-2222-4333-8444-555555555555"

const build = async (pages: ReadonlyArray<object>) => {
    const em = mockEntityManager()
    const builders = queueQueryBuilders(em, pages)
    const moduleRef = await Test.createTestingModule({
        providers: [BrainFactsPagingService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(BrainFactsPagingService), builders, em }
}

describe("BrainFactsPagingService (BRAIN-LIMITS item 4)", () => {
    it("a cursor round-trips the change instant with its microseconds and the id; a foreign cursor is no cursor", () => {
        expect(positionOf(cursorOf({ at: AT, id: ID }))).toEqual({ at: AT, id: ID })
        expect(positionOf("bm90LWEtY3Vyc29y")).toBeNull()
        expect(positionOf(null)).toBeNull()
        expect(positionOf("")).toBeNull()
    })

    it("the first page: newest change first with the id as tie-break, limit + 1 to know if more follow, and the SQL count", async () => {
        const A = "aaaaaaaa-0000-4000-8000-000000000000"
        const B = "bbbbbbbb-0000-4000-8000-000000000000"
        const C = "cccccccc-0000-4000-8000-000000000000"
        const rows = [facts.rowOf({ id: A }), facts.rowOf({ id: B }), facts.rowOf({ id: C })]
        const { service, builders } = await build([{ getMany: rows }, { getCount: 5000 }, { getRawOne: { at: AT } }])

        const page = await service.page(facts.WS, {}, 2, null)

        expect(page.facts.map((fact) => fact.id)).toEqual([A, B])
        expect(page.total).toBe(5000)
        expect(positionOf(page.nextCursor)).toEqual({ at: AT, id: B })
        const [read, count, instant] = builders
        expect(instant?.callsOf("select")).toEqual([["f.updated_at::text", "at"]])
        expect(read?.callsOf("where")[0]).toEqual([
            "f.workspaceId = :workspaceId AND f.status IN (:...statuses)",
            { workspaceId: facts.WS, statuses: ["active", "proposed", "scheduled"] },
        ])
        expect(read?.callsOf("orderBy")).toEqual([["f.updated_at", "DESC"]])
        expect(read?.callsOf("addOrderBy")).toEqual([["f.id", "DESC"]])
        expect(read?.callsOf("limit")).toEqual([[3]])
        expect(count?.callsOf("getCount")).toHaveLength(1)
    })

    it("a next page starts strictly after the cursor; the last page has no cursor; the filters are SQL", async () => {
        const rows = [facts.rowOf({ id: "d" })]
        const { service, builders } = await build([{ getMany: rows }, { getCount: 1 }])

        const page = await service.page(
            facts.WS,
            { statuses: ["proposed"], sourceId: "doc-1", subjectType: "product", search: SEARCH_COMMISSION_VI },
            100,
            cursorOf({ at: AT, id: ID }),
        )

        expect(page.nextCursor).toBeNull()
        const [read] = builders
        const where = (read?.callsOf("andWhere") ?? []).map((call) => call[0])
        expect(where).toEqual([
            "f.subjectType = :subjectType",
            expect.stringContaining("e->>'kind' = 'document'"),
            expect.stringContaining("public.knowledge_fold(:word0)"),
            expect.stringContaining("public.knowledge_fold(:word1)"),
            "(f.updated_at, f.id) < (CAST(:at AS timestamptz), CAST(:id AS uuid))",
        ])
        expect(read?.callsOf("andWhere").at(-1)?.[1]).toEqual({ at: AT, id: ID })
    })

    it("counts by status in ONE grouped statement", async () => {
        const { service, builders } = await build([
            {
                getRawMany: [
                    { status: "active", count: "4800" },
                    { status: "proposed", count: 12 },
                ],
            },
        ])

        const counted = await service.countByStatus(facts.WS, ["active", "proposed"])

        expect(counted).toEqual(
            new Map([
                ["active", 4800],
                ["proposed", 12],
            ]),
        )
        expect(builders[0]?.callsOf("groupBy")).toEqual([["f.status"]])
    })
})
