import { mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { DecisionsErrorCode } from "@modules/domain/decisions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { SalesStatusService } from "./sales-status.service"

const member: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

describe("SalesStatusService", () => {
    const build = async () => {
        const em = mockEntityManager()
        const members = mock<WorkspaceMembersService>()
        members.require.mockResolvedValue(member)
        const moduleRef = await Test.createTestingModule({
            providers: [
                SalesStatusService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
                { provide: WorkspaceMembersService, useValue: members },
            ],
        }).compile()
        return { service: moduleRef.get(SalesStatusService), em }
    }

    it("reports a missing action as not found", async () => {
        const { service, em } = await build()
        em.query.mockResolvedValue([])

        await expect(service.status("user-1", "ws-1", "action-1")).rejects.toMatchObject({
            code: DecisionsErrorCode.NotFound,
        })
    })
})
