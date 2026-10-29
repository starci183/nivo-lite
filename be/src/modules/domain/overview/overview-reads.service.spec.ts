import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OverviewReadsService } from "./overview-reads.service"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [OverviewReadsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(OverviewReadsService)
}

/** Makes the manager hand out the double for its one query builder and gives the double back to inspect. */
const reading = (em: MockEntityManager, rows: ReadonlyArray<unknown>) => {
    const [read] = queueSubQueryBuilders(em, [{ getRawMany: rows }])
    return { argsOf: (method: string) => read?.argsOf(method) }
}

describe("OverviewReadsService", () => {
    it("nests the lead under each responsibility and bounds the read", async () => {
        const em = mockEntityManager()
        const read = reading(em, [
            {
                id: "r-1",
                leadId: "l-1",
                title: "Call",
                leadRef: "l-1",
                leadContactName: "An",
                leadCompany: "Co",
                leadStage: "new",
            },
        ])
        const service = await build(em)

        await expect(service.responsibilities("ws-1")).resolves.toEqual([
            {
                id: "r-1",
                leadId: "l-1",
                title: "Call",
                lead: { id: "l-1", contactName: "An", company: "Co", stage: "new" },
            },
        ])
        expect(read.argsOf("where")).toEqual([["r.workspace_id = :workspaceId", { workspaceId: "ws-1" }]])
        expect(read.argsOf("orderBy")).toEqual([["r.due_at", "ASC", "NULLS LAST"]])
        expect(read.argsOf("limit")).toEqual([[2000]])
    })

    it.each([
        ["agents", 200],
        ["leads", 10_000],
        ["pending", 2000],
        ["exceptions", 100],
    ] as const)("bounds the %s read at %d rows", async (method, bound) => {
        const em = mockEntityManager()
        const read = reading(em, [])
        const service = await build(em)

        await expect(service[method]("ws-1")).resolves.toEqual([])
        expect(read.argsOf("limit")).toEqual([[bound]])
    })

    it("limits the evidence lines to the count asked, newest first", async () => {
        const em = mockEntityManager()
        const read = reading(em, [{ id: "e-1" }])
        const service = await build(em)

        await expect(service.events("ws-1", 6)).resolves.toEqual([{ id: "e-1" }])
        expect(read.argsOf("orderBy")).toEqual([["e.created_at", "DESC"]])
        expect(read.argsOf("limit")).toEqual([[6]])
    })

    it("answers a null lead for an exception whose lead is gone", async () => {
        const em = mockEntityManager()
        queueSubQueryBuilders(em, [{ getRawMany: [{ id: "w-1", leadId: null, leadRef: null }] }])
        const service = await build(em)

        const [exception] = await service.exceptions("ws-1")

        expect(exception?.lead).toBeNull()
        expect(exception?.id).toBe("w-1")
    })

    it("fills the lead of an exception from its columns", async () => {
        const em = mockEntityManager()
        queueSubQueryBuilders(em, [
            {
                getRawMany: [
                    { id: "w-1", leadRef: "l-1", leadContactName: "An", leadCompany: "Co", leadChannel: "zalo" },
                ],
            },
        ])
        const service = await build(em)

        const [exception] = await service.exceptions("ws-1")

        expect(exception?.lead).toEqual({ id: "l-1", contactName: "An", company: "Co", channel: "zalo" })
    })
})
