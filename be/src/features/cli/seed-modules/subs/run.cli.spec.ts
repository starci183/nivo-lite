import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ModulesService } from "@modules/domain/modules"
import { LOGGER, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RunSeedModulesCli } from "./run.cli"

describe("RunSeedModulesCli", () => {
    it("syncs the catalogue once and logs what was written and what is stale", async () => {
        const report = { modules: 11, actions: 40, staleModules: ["old"], staleActions: [] }
        const modules = mock<ModulesService>()
        modules.sync.mockResolvedValue(report)
        const logger = mock<Logger>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                RunSeedModulesCli,
                { provide: ModulesService, useValue: modules },
                { provide: LOGGER, useValue: logger },
            ],
        }).compile()

        await expect(moduleRef.get(RunSeedModulesCli).run()).resolves.toBeUndefined()

        expect(modules.sync).toHaveBeenCalledTimes(1)
        expect(logger.info).toHaveBeenCalledWith(LoggingLogEvent.SeedsApplied, { seed: "modules", ...report })
    })
})
