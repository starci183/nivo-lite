import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"
import { RunSeedAutomationsCli } from "./run.cli"

describe("RunSeedAutomationsCli", () => {
    it("syncs the catalogue from the definition files once", async () => {
        const templates = mock<AutomationTemplatesService>()
        templates.syncFromFiles.mockResolvedValue(["a"])
        const moduleRef = await Test.createTestingModule({
            providers: [RunSeedAutomationsCli, { provide: AutomationTemplatesService, useValue: templates }],
        }).compile()

        await expect(moduleRef.get(RunSeedAutomationsCli).run()).resolves.toBeUndefined()

        expect(templates.syncFromFiles).toHaveBeenCalledTimes(1)
    })
})
