import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, IsNull } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { ExecutionsFiguresService } from "./executions-figures.service"
import { ExecutionEntity } from "./persistence/entities"

const draftOf = entityOf(ExecutionEntity, {
    id: "x1",
    responsibilityId: "r1",
    createdAt: new Date("2026-10-12T03:00:00.000Z"),
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ExecutionsFiguresService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ExecutionsFiguresService)
}

describe("ExecutionsFiguresService", () => {
    it("counts the approved executions of the workspace", async () => {
        const em = mockEntityManager({ count: [ExecutionEntity, 3] })

        await expect((await build(em)).countApproved("ws-1")).resolves.toBe(3)
        expect(em.count).toHaveBeenCalledWith(ExecutionEntity, { where: { workspaceId: "ws-1", status: "approved" } })
    })

    it("counts the drafts waiting without a work item", async () => {
        const em = mockEntityManager({ count: [ExecutionEntity, 2] })

        await expect((await build(em)).countPendingWithoutWork("ws-1")).resolves.toBe(2)
        expect(em.count).toHaveBeenCalledWith(ExecutionEntity, {
            where: { workspaceId: "ws-1", status: "pending_approval", workItemId: IsNull() },
        })
    })

    it("lists the waiting drafts newest first, bounded", async () => {
        const em = mockEntityManager({ find: [ExecutionEntity, [draftOf()]] })

        await expect((await build(em)).pendingOf("ws-1", 2000)).resolves.toEqual([
            { id: "x1", responsibilityId: "r1", createdAt: new Date("2026-10-12T03:00:00.000Z") },
        ])
        expect(em.find).toHaveBeenCalledWith(ExecutionEntity, {
            select: { id: true, responsibilityId: true, createdAt: true },
            where: { workspaceId: "ws-1", status: "pending_approval" },
            order: { createdAt: "DESC" },
            take: 2000,
        })
    })

    it("asks whether any of the steps has an approved execution, and nothing for no steps", async () => {
        const em = mockEntityManager({ exists: [ExecutionEntity, true] })
        const service = await build(em)

        await expect(service.hasApprovedAmong("ws-1", [])).resolves.toBe(false)
        expect(em.exists).not.toHaveBeenCalled()
        await expect(service.hasApprovedAmong("ws-1", ["r1"])).resolves.toBe(true)
        expect(em.exists).toHaveBeenCalledWith(ExecutionEntity, {
            where: { workspaceId: "ws-1", status: "approved", responsibilityId: In(["r1"]) },
        })
    })
})
