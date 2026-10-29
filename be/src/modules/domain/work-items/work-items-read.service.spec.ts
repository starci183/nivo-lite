import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { WorkItemsReadService } from "./work-items-read.service"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkItemsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(WorkItemsReadService)
}

describe("WorkItemsReadService", () => {
    it("counts the work items of the workspace in one state", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getCount: 4 }])

        await expect((await build(em)).countByStatus("ws-1", "waiting_decision")).resolves.toBe(4)
        expect(fake?.callsOf("where")).toEqual([
            [
                "w.workspaceId = :workspaceId AND w.status = :status",
                { workspaceId: "ws-1", status: "waiting_decision" },
            ],
        ])
    })

    it("reads the newest work items with the proposal texts, newest first, bounded", async () => {
        const em = mockEntityManager()
        const row = { id: "w1", summary: "Quote" }
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [row] }])

        await expect((await build(em)).newestFigures("ws-1", 2000)).resolves.toEqual([row])
        expect(fake?.callsOf("where")).toEqual([["w.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        expect(fake?.callsOf("addSelect")).toContainEqual(["w.proposal ->> 'summary'", "summary"])
        expect(fake?.callsOf("addSelect")).toContainEqual(["w.proposal -> 'fields' ->> 'contact_name'", "contact"])
        expect(fake?.callsOf("addSelect")).toContainEqual(["w.proposal -> 'fields' ->> 'customer'", "customer"])
        expect(fake?.callsOf("orderBy")).toEqual([["w.createdAt", "DESC"]])
        expect(fake?.callsOf("limit")).toEqual([[2000]])
    })

    it("reads the work items waiting for a decision or failed, oldest first, bounded", async () => {
        const em = mockEntityManager()
        const row = { id: "w2", assignedStaffId: "s1" }
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [row] }])

        await expect((await build(em)).exceptions("ws-1", 100)).resolves.toEqual([row])
        expect(fake?.callsOf("where")).toEqual([
            [
                "w.workspaceId = :workspaceId AND w.status IN (:...states)",
                { workspaceId: "ws-1", states: ["waiting_decision", "failed"] },
            ],
        ])
        expect(fake?.callsOf("addSelect")).toContainEqual(["w.assignedStaffId", "assignedStaffId"])
        expect(fake?.callsOf("orderBy")).toEqual([["w.createdAt", "ASC"]])
        expect(fake?.callsOf("limit")).toEqual([[100]])
    })

    it("reads the newest work items of one department, bounded", async () => {
        const em = mockEntityManager()
        const row = { id: "w3", action: "send_quote", at: "2026-10-12T00:00:00.000Z" }
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [row] }])

        await expect((await build(em)).recentOfDepartment("ws-1", "sales", 8)).resolves.toEqual([row])
        expect(fake?.callsOf("where")).toEqual([
            [
                "w.workspaceId = :workspaceId AND w.department = :department",
                { workspaceId: "ws-1", department: "sales" },
            ],
        ])
        expect(fake?.callsOf("addSelect")).toContainEqual(["w.leadId", "leadId"])
        expect(fake?.callsOf("limit")).toEqual([[8]])
    })
})
