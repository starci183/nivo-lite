import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkItemEntity } from "./persistence/entities"
import { WorkInHandService } from "./work-in-hand.service"

const seatWith = (staffId: string | null) => ({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "staff" as const,
    staffId,
    displayName: "An",
    status: "active" as const,
})

const build = async (entityManager: MockEntityManager, staffId: string | null) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(seatWith(staffId))
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkInHandService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(WorkInHandService), members }
}

describe("WorkInHandService > openCountOf", () => {
    it("counts the open work items assigned to the caller's staff row", async () => {
        const em = mockEntityManager({ count: [WorkItemEntity, 3] })
        const { service, members } = await build(em, "staff-1")

        await expect(service.openCountOf("user-1", "ws-1")).resolves.toBe(3)
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(em.count).toHaveBeenCalledWith(WorkItemEntity, {
            where: { workspaceId: "ws-1", assignedStaffId: "staff-1", status: In(["queued", "waiting_decision"]) },
        })
    })

    it("counts nothing for a seat that is no staff row", async () => {
        const em = mockEntityManager()
        const { service } = await build(em, null)

        await expect(service.openCountOf("user-1", "ws-1")).resolves.toBe(0)
        expect(em.count).not.toHaveBeenCalled()
    })
})
