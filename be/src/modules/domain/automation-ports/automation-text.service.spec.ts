import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { DirectGenerationService, GenerationsService } from "@modules/domain/ai-generations"
import type { GenerationOutcome } from "@modules/domain/ai-generations"
import type { AutomationTextRequest } from "@modules/domain/automations"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AutomationPortsLogEvent } from "./automation-ports.log-events"
import { AutomationTextService } from "./automation-text.service"

const requestOf = builder<AutomationTextRequest>({
    workspaceId: "workspace-1",
    purpose: "personalize",
    system: "Write a warm message",
    prompt: "Invite An to return",
})

const successOf = builder<Extract<GenerationOutcome, { ok: true }>>({
    ok: true,
    output: " \n Welcome back, An! \t",
    generationId: "generation-1",
    timings: {},
    usage: null,
})

const setup = async () => {
    const direct = mock<DirectGenerationService>()
    const generations = mock<GenerationsService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationTextService,
            { provide: DirectGenerationService, useValue: direct },
            { provide: GenerationsService, useValue: generations },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { subject: moduleRef.get(AutomationTextService), direct, generations, logger }
}

describe("AutomationTextService", () => {
    describe.each<AutomationTextRequest["purpose"]>(["personalize", "per_case", "classify"])("%s", (purpose) => {
        const request = requestOf({ purpose })

        it("meters text with the old prompt and deadline and trims the output", async () => {
            const { subject, direct, generations, logger } = await setup()
            const generate = purpose === "personalize" ? generations.generate : direct.run
            const unused = purpose === "personalize" ? direct.run : generations.generate
            generate.mockResolvedValue(successOf())

            await expect(subject.generate(request)).resolves.toBe("Welcome back, An!")

            expect(generate.mock.calls).toEqual([
                [
                    {
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
                    },
                ],
            ])
            expect(unused).not.toHaveBeenCalled()
            expect(logger.error).not.toHaveBeenCalled()
        })

        it.each(["", " \n\t "])("answers none for empty generated text %j", async (output) => {
            const { subject, direct, generations, logger } = await setup()
            const generate = purpose === "personalize" ? generations.generate : direct.run
            generate.mockResolvedValue(successOf({ output }))

            await expect(subject.generate(request)).resolves.toBeNull()

            expect(logger.error).not.toHaveBeenCalled()
        })

        it.each<Extract<GenerationOutcome, { ok: false }>["reason"]>([
            "quota",
            "engine_offline",
            "timeout",
            "error",
            "not_configured",
        ])("answers none for a %s outcome", async (reason) => {
            const { subject, direct, generations, logger } = await setup()
            const generate = purpose === "personalize" ? generations.generate : direct.run
            generate.mockResolvedValue({ ok: false, reason, message: "Unavailable" })

            await expect(subject.generate(request)).resolves.toBeNull()

            expect(logger.error).not.toHaveBeenCalled()
        })

        it.each([new Error("Engine unavailable"), "Generation refused"])(
            "logs a thrown generation failure and answers none",
            async (cause) => {
                const { subject, direct, generations, logger } = await setup()
                const generate = purpose === "personalize" ? generations.generate : direct.run
                generate.mockRejectedValue(cause)

                await expect(subject.generate(request)).resolves.toBeNull()

                expect(logger.error.mock.calls).toEqual([
                    [
                        AutomationPortsLogEvent.TextGenerationFailed,
                        cause,
                        { workspaceId: request.workspaceId, purpose: `automation_${purpose}` },
                    ],
                ])
            },
        )
    })
})
