import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { generationRow, pollOptions } from "@tests/fixtures/builders/ai-generations.builder"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GenerateParams } from "./ai-generations.contracts"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import { DirectGenerationService } from "./direct-generation.service"
import { GenerationRunnerService } from "./generation-runner.service"
import { GenerationsService } from "./generations.service"
import { AiGenerationEntity } from "./persistence/entities"

const paramsOf = builder<GenerateParams>({
    workspaceId: "w1",
    purpose: "setup-chat",
    messages: [{ role: "user", content: "hi" }],
    responseFormat: "text",
    kind: "relay",
    module: "office",
})

const BUSY = "The assistant is busy"

const build = async (entityManager: MockEntityManager) => {
    const logger = mock<Logger>()
    const generations = mock<GenerationsService>({
        refusalOf: jest.fn(() => Promise.resolve(null)),
        busyText: jest.fn(() => BUSY),
    })
    const runner = mock<GenerationRunnerService>({ run: jest.fn(() => Promise.resolve("done" as const)) })
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
    it("writes the row, runs it right here and answers its text", async () => {
        const em = mockEntityManager({
            insert: [AiGenerationEntity, { identifiers: [{ id: "g1" }] }],
            findOne: [
                AiGenerationEntity,
                generationRow({ status: "done", output: { text: "hello" }, timings: { total_ms: 12 } }),
            ],
        })
        const { service, runner } = await build(em)

        const outcome = await service.run(paramsOf({ timeoutMs: 1000 }))

        expect(outcome).toEqual({
            ok: true,
            output: "hello",
            generationId: "g1",
            timings: { total_ms: 12 },
            usage: null,
        })
        expect(em.insert).toHaveBeenCalledWith(AiGenerationEntity, {
            workspaceId: "w1",
            purpose: "setup-chat",
            module: "office",
            usageKind: "relay",
            input: { messages: [{ role: "user", content: "hi" }], response_format: "text", timeout_ms: 5000 },
        })
        expect(runner.run).toHaveBeenCalledWith({ generationId: "g1", workspaceId: "w1" })
    })

    it("answers the refusal of the allowance or the engine and writes nothing", async () => {
        const { service, generations } = await build(mockEntityManager())
        generations.refusalOf.mockResolvedValue({ ok: false, reason: "quota", message: "Over the plan" })

        await expect(service.run(paramsOf())).resolves.toEqual({ ok: false, reason: "quota", message: "Over the plan" })
    })

    it("answers the busy sentence when the run left no text", async () => {
        const em = mockEntityManager({
            insert: [AiGenerationEntity, { identifiers: [{ id: "g1" }] }],
            findOne: [AiGenerationEntity, generationRow({ status: "error" })],
        })
        const { service } = await build(em)

        await expect(service.run(paramsOf())).resolves.toEqual({ ok: false, reason: "error", message: BUSY })
    })

    it("answers the busy sentence when the generation disappeared after running", async () => {
        const em = mockEntityManager({
            insert: [AiGenerationEntity, { identifiers: [{ id: "g1" }] }],
            findOne: [AiGenerationEntity, null],
        })
        const { service, generations, logger, runner } = await build(em)
        const params = paramsOf()

        await expect(service.run(params)).resolves.toEqual({ ok: false, reason: "error", message: BUSY })

        expect(runner.run).toHaveBeenCalledWith({ generationId: "g1", workspaceId: "w1" })
        expect(em.findOne).toHaveBeenLastCalledWith(AiGenerationEntity, pollOptions("g1", "w1"))
        expect(generations.busyText).toHaveBeenCalledWith(params)
        expect(logger.error).not.toHaveBeenCalled()
    })
})

describe("DirectGenerationService", () => {
    it("answers the busy sentence when the stored generation is still running", async () => {
        const em = mockEntityManager({
            insert: [AiGenerationEntity, { identifiers: [{ id: "g1" }] }],
            findOne: [AiGenerationEntity, generationRow({ status: "running" })],
        })
        const { service, generations, logger } = await build(em)
        const params = paramsOf()

        await expect(service.run(params)).resolves.toEqual({ ok: false, reason: "error", message: BUSY })

        expect(em.findOne).toHaveBeenLastCalledWith(AiGenerationEntity, pollOptions("g1", "w1"))
        expect(generations.busyText).toHaveBeenCalledWith(params)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs a failed insert and answers the busy sentence", async () => {
        const em = mockEntityManager({ insert: [AiGenerationEntity, { identifiers: [] }] })
        const { service, logger, runner } = await build(em)

        await expect(service.run(paramsOf())).resolves.toEqual({ ok: false, reason: "error", message: BUSY })

        expect(logger.error).toHaveBeenCalledWith(AiGenerationsLogEvent.GenerationFailed, expect.anything(), {
            purpose: "setup-chat",
        })
        expect(runner.run).not.toHaveBeenCalled()
    })
})
