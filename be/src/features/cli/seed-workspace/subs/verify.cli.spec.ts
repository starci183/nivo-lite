import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceSeedService } from "@modules/domain/workspace-seed"
import { VerifySeedWorkspaceCli } from "./verify.cli"

describe("VerifySeedWorkspaceCli", () => {
    it("delegates private verify input to the owning capability once", async () => {
        const service = mock<WorkspaceSeedService>()
        const moduleRef = await Test.createTestingModule({
            providers: [VerifySeedWorkspaceCli, { provide: WorkspaceSeedService, useValue: service }],
        }).compile()
        await expect(moduleRef.get(VerifySeedWorkspaceCli).run()).resolves.toBeUndefined()
        expect(service.verifyOperator).toHaveBeenCalledTimes(1)
    })
})
