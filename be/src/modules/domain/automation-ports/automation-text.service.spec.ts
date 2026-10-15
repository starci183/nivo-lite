import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import type { AutomationTextRequest } from "@modules/domain/automations"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AutomationPortsLogEvent } from "./automation-ports.log-events"
import { AutomationTextService } from "./automation-text.service"

const request: AutomationTextRequest = {
    workspaceId: "workspace-1",
    purpose: "personalize",
    system: "Write a warm message",
    prompt: "Invite An to return",
}

const setup = async () => {
    const generations = mock<DirectGenerationService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationTextService,
            { provide: DirectGenerationService, useValue: generations },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { subject: moduleRef.get(AutomationTextService), generations, logger }
}

describe("AutomationTextService", () => {
    it.each<AutomationTextRequest["purpose"]>(["personalize", "per_case", "classify"])(
        "meters %s text with the old prompt and deadline and trims the output",
        async (purpose) => {
            const { subject, generations, logger } = await setup()
            generations.run.mockResolvedValue({
                ok: true,
                output: " \n Welcome back, An! \t",
                generationId: "generation-1",
                timings: {},
                usage: null,
            })

            await expect(subject.generate({ ...request, purpose })).resolves.toBe("Welcome back, An!")

            expect(generations.run).toHaveBeenCalledTimes(1)
            expect(generations.run).toHaveBeenCalledWith({
                workspaceId: request.workspaceId,
                purpose: `automation_${purpose}`,
                kind: "engine",
                module: "other",
                timeoutMs: 40_000,
                responseFormat: "text",
                messages: [
                    { role: "system", content: request.system },
                    { role: "user", content: request.prompt },
                ],
            })
            expect(logger.error).not.toHaveBeenCalled()
        },
    )

    it.each(["", " \n\t "])("answers none for empty generated text %j", async (output) => {
        const { subject, generations } = await setup()
        generations.run.mockResolvedValue({
            ok: true,
            output,
            generationId: "generation-1",
            timings: {},
            usage: null,
        })

        await expect(subject.generate(request)).resolves.toBeNull()
    })

    it.each<"quota" | "engine_offline" | "timeout" | "error" | "not_configured">([
        "quota",
        "engine_offline",
        "timeout",
        "error",
        "not_configured",
    ])("answers none for a %s outcome", async (reason) => {
        const { subject, generations, logger } = await setup()
        generations.run.mockResolvedValue({ ok: false, reason, message: "Unavailable" })

        await expect(subject.generate(request)).resolves.toBeNull()
        expect(logger.error).not.toHaveBeenCalled()
    })

    it.each([new Error("Engine unavailable"), "Generation refused"])(
        "logs a thrown generation failure and answers none",
        async (cause) => {
            const { subject, generations, logger } = await setup()
            generations.run.mockRejectedValue(cause)

            await expect(subject.generate(request)).resolves.toBeNull()

            expect(logger.error).toHaveBeenCalledWith(AutomationPortsLogEvent.TextGenerationFailed, cause, {
                workspaceId: request.workspaceId,
                purpose: "automation_personalize",
            })
            expect(logger.error).toHaveBeenCalledTimes(1)
        },
    )
})
