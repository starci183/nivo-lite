import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ShiftsErrorCode } from "./errors/shifts.error"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsSetupService } from "./shifts-setup.service"
import { SAVE_POSITION } from "./persistence/shifts-workbench.sql"

const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
}

const build = async () => {
    const entityManager = mockEntityManager({ query: [SAVE_POSITION, [{ id: "position-1" }]] })
    const clock = new FakeClock("2026-10-12T10:00:00.000Z")
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const data = mock<ShiftsDataService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsSetupService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ShiftsDataService, useValue: data },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsSetupService), entityManager }
}

describe("ShiftsSetupService", () => {
    it("creates a position with the trimmed name and the default colour", async () => {
        const { service, entityManager } = await build()

        await expect(service.savePosition("user-1", "ws-1", { name: "  Barista  " })).resolves.toEqual({
            id: "position-1",
        })

        expect(entityManager.query).toHaveBeenCalledWith(SAVE_POSITION, ["ws-1", null, "Barista", "#2f6fed"])
    })

    it("refuses a blank position name before writing", async () => {
        const { service, entityManager } = await build()

        await expect(service.savePosition("user-1", "ws-1", { name: "   " })).rejects.toMatchObject({
            code: ShiftsErrorCode.SetupFieldInvalid,
        })

        expect(entityManager.query).not.toHaveBeenCalled()
    })
})
