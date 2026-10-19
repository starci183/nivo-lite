import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceSeedService } from "@modules/domain/workspace-seed"
import { RoleSeedWorkspaceCli } from "./role.cli"

describe("RoleSeedWorkspaceCli", () => {
    it("delegates private role input to the owning capability once", async () => {
        const service = mock<WorkspaceSeedService>()
        const moduleRef = await Test.createTestingModule({
            providers: [RoleSeedWorkspaceCli, { provide: WorkspaceSeedService, useValue: service }],
        }).compile()
        await expect(moduleRef.get(RoleSeedWorkspaceCli).run()).resolves.toBeUndefined()
        expect(service.roleOperator).toHaveBeenCalledTimes(1)
    })
})
