import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { NivoSeedService } from "@modules/domain/nivo-knowledge"
import { LOGGER, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RunSeedKnowledgeCli } from "./run.cli"

describe("RunSeedKnowledgeCli", () => {
    const build = async () => {
        const seed = mock<NivoSeedService>()
        const logger = mock<Logger>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                RunSeedKnowledgeCli,
                { provide: NivoSeedService, useValue: seed },
                { provide: LOGGER, useValue: logger },
            ],
        }).compile()
        return { cli: moduleRef.get(RunSeedKnowledgeCli), seed, logger }
    }

    it("publishes the default folder and logs what was written", async () => {
        const report = { inserted: 3, updated: 1, removed: 0, embedded: 2 }
        const { cli, seed, logger } = await build()
        seed.seedFolder.mockResolvedValue(report)

        await expect(cli.run([], {})).resolves.toBeUndefined()

        expect(seed.seedFolder).toHaveBeenCalledWith(undefined)
        expect(logger.info).toHaveBeenCalledWith(LoggingLogEvent.SeedsApplied, { seed: "nivo-knowledge", ...report })
    })

    it("publishes the folder the option names", async () => {
        const report = { inserted: 0, updated: 4, removed: 1, embedded: 4 }
        const { cli, seed, logger } = await build()
        seed.seedFolder.mockResolvedValue(report)

        await expect(cli.run([], { dir: "knowledge/custom" })).resolves.toBeUndefined()

        expect(seed.seedFolder).toHaveBeenCalledWith("knowledge/custom")
        expect(logger.info).toHaveBeenCalledWith(LoggingLogEvent.SeedsApplied, { seed: "nivo-knowledge", ...report })
    })

    it("reads the folder flag as the text it was given", async () => {
        const { cli } = await build()

        expect(cli.parseDir("knowledge/nivo")).toBe("knowledge/nivo")
    })
})
