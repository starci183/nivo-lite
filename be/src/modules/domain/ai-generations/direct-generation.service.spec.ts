import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GenerateParams, GenerationFailure } from "./ai-generations.contracts"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import { DirectGenerationService } from "./direct-generation.service"
import { GenerationRunnerService } from "./generation-runner.service"
import { GenerationsService } from "./generations.service"
import { INSERT_GENERATION } from "./persistence/ai-generations.sql"

const PARAMS: GenerateParams = {
    workspaceId: "ws-1",
    purpose: "relay",
    messages: [{ role: "user", content: "hello" }],
    responseFormat: "text",
    kind: "relay",
    module: "office",
}

const REFUSAL: GenerationFailure = { ok: false, reason: "quota", message: "The plan is full." }

const build = async (rows: ReadonlyArray<unknown> = []) => {
    const entityManager = mockEntityManager({ query: [INSERT_GENERATION, rows] })
    const logger = mock<Logger>()
    const generations = mock<GenerationsService>()
    generations.refusalOf.mockResolvedValue(null)
    generations.busyText.mockReturnValue("Try again.")
    const runner = mock<GenerationRunnerService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DirectGenerationService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: LOGGER, useValue: logger },
            { provide: GenerationsService, useValue: generations },
            { provide: GenerationRunnerService, useValue: runner },
        ],
    }).compile()
    return { service: moduleRef.get(DirectGenerationService), logger, generations, runner }
}

describe("DirectGenerationService", () => {
    it("returns a quota refusal without writing a generation", async () => {
        const { service, generations, runner } = await build()
        generations.refusalOf.mockResolvedValue(REFUSAL)

        await expect(service.run(PARAMS)).resolves.toEqual(REFUSAL)

        expect(runner.run).not.toHaveBeenCalled()
    })

    it("answers the busy sentence when the insert writes no row", async () => {
        const { service, logger, generations } = await build([])

        await expect(service.run(PARAMS)).resolves.toEqual({
            ok: false,
            reason: "error",
            message: "Try again.",
        })

        expect(generations.busyText).toHaveBeenCalledWith(PARAMS)
        expect(logger.error).toHaveBeenCalledWith(AiGenerationsLogEvent.GenerationFailed, expect.any(Error), {
            purpose: "relay",
        })
    })
})
