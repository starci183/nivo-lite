import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ShiftsErrorCode } from "./errors/shifts.error"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsWorkbenchService } from "./shifts-workbench.service"

const build = async () => {
    const entityManager = mockEntityManager()
    const clock = new FakeClock("2026-10-12T10:00:00.000Z")
    const members = mock<WorkspaceMembersService>()
    const data = mock<ShiftsDataService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsWorkbenchService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ShiftsDataService, useValue: data },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsWorkbenchService), members }
}

describe("ShiftsWorkbenchService", () => {
    it("refuses a week that is not a calendar day before reading membership", async () => {
        const { service, members } = await build()

        await expect(service.bench("user-1", "ws-1", "not-a-day")).rejects.toMatchObject({
            code: ShiftsErrorCode.WeekInvalid,
        })

        expect(members.require).not.toHaveBeenCalled()
    })
})
