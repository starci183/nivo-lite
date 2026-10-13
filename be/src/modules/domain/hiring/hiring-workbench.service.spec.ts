import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringLinksService } from "./hiring-links.service"
import { HiringSettingsService } from "./hiring-settings.service"
import { HiringWorkbenchService } from "./hiring-workbench.service"

describe("HiringWorkbenchService", () => {
    const build = async () => {
        const members = mock<WorkspaceMembersService>()
        const refusal = new Error("not a manager")
        members.require.mockRejectedValue(refusal)
        const moduleRef = await Test.createTestingModule({
            providers: [
                HiringWorkbenchService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
                { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
                { provide: WorkspaceMembersService, useValue: members },
                { provide: HiringSettingsService, useValue: mock<HiringSettingsService>() },
                { provide: HiringLinksService, useValue: mock<HiringLinksService>() },
                { provide: HiringCandidatesService, useValue: mock<HiringCandidatesService>() },
            ],
        }).compile()
        return { service: moduleRef.get(HiringWorkbenchService), refusal }
    }

    it("does not open the bench when membership is refused", async () => {
        const { service, refusal } = await build()

        await expect(service.bench("user-1", "ws-1")).rejects.toBe(refusal)
    })
})
