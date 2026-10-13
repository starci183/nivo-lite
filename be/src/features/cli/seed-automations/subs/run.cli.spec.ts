import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"
import { RunSeedAutomationsCli } from "./run.cli"

describe("RunSeedAutomationsCli", () => {
    it("syncs the catalogue from the template constants once", async () => {
        const templates = mock<AutomationTemplatesService>()
        templates.syncFromCatalog.mockResolvedValue(["a"])
        const moduleRef = await Test.createTestingModule({
            providers: [RunSeedAutomationsCli, { provide: AutomationTemplatesService, useValue: templates }],
        }).compile()

        await expect(moduleRef.get(RunSeedAutomationsCli).run()).resolves.toBeUndefined()

        expect(templates.syncFromCatalog).toHaveBeenCalledTimes(1)
    })
})
