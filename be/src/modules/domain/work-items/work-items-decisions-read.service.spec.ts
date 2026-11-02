import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { contractOf, entityOf, rowOf } from "@tests/fixtures/builders/work-items.builder"
import { WorkItemsDecisionsReadService } from "./work-items-decisions-read.service"
import { WorkItemEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkItemsDecisionsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(WorkItemsDecisionsReadService)
}

describe("WorkItemsDecisionsReadService", () => {
    it("reads the decisions a department waits on, oldest first, bounded", async () => {
        const em = mockEntityManager()
        const row = { id: "w1", action: "send_purchase_order", proposal: {}, created_at: "2026-10-01" }
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [row] }])

        await expect((await build(em)).waiting("ws-1", "inventory", 20)).resolves.toEqual([row])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkItemEntity, "w")
        expect(fake?.callsOf("where")).toEqual([
            [
                "w.workspace_id = :workspaceId AND w.department = :department AND w.status = 'waiting_decision'",
                { workspaceId: "ws-1", department: "inventory" },
            ],
        ])
        expect(fake?.callsOf("orderBy")).toEqual([["w.created_at"]])
        expect(fake?.callsOf("limit")).toEqual([[20]])
    })

    it.each([
        [{ attempts: 3 }, 3],
        [undefined, 0],
    ])("counts the work items whose key starts with a prefix: %j", async (answer, expected) => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getRawOne: answer }])

        await expect((await build(em)).countWithKeyPrefix("ws-1", "send_po:order:po-1:")).resolves.toBe(expected)
        expect(fake?.callsOf("where")).toEqual([
            [
                "w.workspace_id = :workspaceId AND w.dedupe_key LIKE :pattern",
                { workspaceId: "ws-1", pattern: "send_po:order:po-1:%" },
            ],
        ])
    })

    it("counts the work items a department has waiting for a decision", async () => {
        const em = mockEntityManager({ count: [WorkItemEntity, 4] })

        await expect((await build(em)).countWaiting("ws-1", "hiring")).resolves.toBe(4)
        expect(em.count).toHaveBeenCalledWith(WorkItemEntity, {
            where: { workspaceId: "ws-1", department: "hiring", status: "waiting_decision" },
        })
    })

    it("narrows the key count to one action when asked", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getRawOne: { attempts: 2 } }])

        await expect((await build(em)).countWithKeyPrefix("ws-1", "offer:o1:", "send_offer")).resolves.toBe(2)
        expect(fake?.callsOf("andWhere")).toEqual([["w.action = :action", { action: "send_offer" }]])
    })
})

describe("WorkItemsDecisionsReadService.claimDecision", () => {
    it("leaves a missing owner busy under the caller's row lock without reading the service manager", async () => {
        const own = mockEntityManager()
        const manager = mockEntityManager({ findOne: [WorkItemEntity, null] })
        await expect((await build(own)).claimDecision(manager, "ws-1", "item-1")).resolves.toEqual({ kind: "busy" })
        expect(manager.findOne).toHaveBeenCalledWith(WorkItemEntity, {
            where: { workspaceId: "ws-1", id: "item-1" },
            lock: { mode: "pessimistic_write" },
        })
        expect(own.findOne).not.toHaveBeenCalled()
    })

    it.each([
        ["queued", "busy"],
        ["failed", "busy"],
        ["waiting_decision", "open"],
        ["done", "closed"],
        ["rejected", "closed"],
    ] as const)(
        "classifies the locked %s owner as %s and preserves its exact approved snapshot",
        async (status, kind) => {
            const row = rowOf({
                status,
                proposal: { summary: "Edited", fields: { args_json: '{"qty":1}' }, draft: "One order" },
            })
            const manager = mockEntityManager({ findOne: [WorkItemEntity, entityOf(row)] })
            const service = await build(mockEntityManager())
            await expect(service.claimDecision(manager, "ws-1", "item-1")).resolves.toEqual(
                kind === "closed" ? { kind, item: contractOf(row) } : { kind },
            )
            expect(manager.findOne).toHaveBeenCalledWith(WorkItemEntity, {
                where: { workspaceId: "ws-1", id: "item-1" },
                lock: { mode: "pessimistic_write" },
            })
        },
    )
})
