import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { BrainCommandsService } from "@modules/domain/brain-commands"
import { KnowledgeDriveService, KnowledgeReembedService, KnowledgeSearchService } from "@modules/domain/knowledge"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainCommandRunnerService } from "./brain-command-runner.service"
import { BrainLearningService } from "./brain-learning.service"
import { BrainLogEvent } from "./brain.log-events"
import { BrainService } from "./brain.service"

describe("BrainCommandRunnerService", () => {
    const build = async () => {
        const logger = mock<Logger>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                BrainCommandRunnerService,
                { provide: LOGGER, useValue: logger },
                { provide: BrainCommandsService, useValue: mock<BrainCommandsService>() },
                { provide: BrainService, useValue: mock<BrainService>() },
                { provide: BrainLearningService, useValue: mock<BrainLearningService>() },
                { provide: KnowledgeSourcesService, useValue: mock<KnowledgeSourcesService>() },
                { provide: KnowledgeSearchService, useValue: mock<KnowledgeSearchService>() },
                { provide: KnowledgeDriveService, useValue: mock<KnowledgeDriveService>() },
                { provide: KnowledgeReembedService, useValue: mock<KnowledgeReembedService>() },
            ],
        }).compile()
        return { service: moduleRef.get(BrainCommandRunnerService), logger }
    }

    it("skips a job that does not name a command", async () => {
        const { service, logger } = await build()

        await expect(service.run({})).resolves.toBe("skipped")
        expect(logger.warn).toHaveBeenCalledWith(BrainLogEvent.PayloadRefused, { job: "command" })
    })

    it("leaves a command row alone when the give-up payload is not a command", async () => {
        const { service } = await build()

        await expect(service.giveUp({})).resolves.toBeUndefined()
    })
})
