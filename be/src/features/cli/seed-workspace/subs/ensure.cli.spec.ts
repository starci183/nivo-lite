import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceSeedService } from "@modules/domain/workspace-seed"
import { EnsureSeedWorkspaceCli } from "./ensure.cli"

describe("EnsureSeedWorkspaceCli", () => {
    it("delegates private ensure input to the owning capability once", async () => {
        const service = mock<WorkspaceSeedService>()
        const moduleRef = await Test.createTestingModule({
            providers: [EnsureSeedWorkspaceCli, { provide: WorkspaceSeedService, useValue: service }],
        }).compile()
        await expect(moduleRef.get(EnsureSeedWorkspaceCli).run()).resolves.toBeUndefined()
        expect(service.seedOperator).toHaveBeenCalledTimes(1)
    })
})
