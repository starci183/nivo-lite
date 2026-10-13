import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkspaceSeedService } from "@modules/domain/workspace-seed"
import { RunSeedWorkspaceCli } from "./run.cli"

describe("RunSeedWorkspaceCli", () => {
    it("seeds the demo account once", async () => {
        const seeds = mock<WorkspaceSeedService>()
        const moduleRef = await Test.createTestingModule({
            providers: [RunSeedWorkspaceCli, { provide: WorkspaceSeedService, useValue: seeds }],
        }).compile()

        await expect(moduleRef.get(RunSeedWorkspaceCli).run()).resolves.toBeUndefined()

        expect(seeds.seedOperator).toHaveBeenCalledTimes(1)
    })
})
