import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ModuleTextRequest } from "@modules/domain/module-ops"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GenerationsService } from "./generations.service"
import { ModuleTextGeneratorService } from "./module-text-generator.service"

const request: ModuleTextRequest = {
    workspaceId: "w1",
    purpose: "inventory_po_message",
    module: "inventory",
    system: "role",
    user: "task",
    timeoutMs: 30_000,
}

const setup = async (generate: jest.Mock): Promise<ModuleTextGeneratorService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModuleTextGeneratorService,
            { provide: GenerationsService, useValue: mock<GenerationsService>({ generate }) },
            { provide: LOGGER, useValue: mock<Logger>({ error: jest.fn() }) },
        ],
    }).compile()
    return moduleRef.get(ModuleTextGeneratorService)
}

describe("ModuleTextGeneratorService", () => {
    it("generates through the single door with the purpose, module and timeout", async () => {
        const generate = jest.fn().mockResolvedValue({ ok: true, output: "text", generationId: "g1" })
        const subject = await setup(generate)

        await expect(subject.generate(request)).resolves.toEqual({ ok: true, output: "text" })

        expect(generate).toHaveBeenCalledWith({
            workspaceId: "w1",
            purpose: "inventory_po_message",
            messages: [
                { role: "system", content: "role" },
                { role: "user", content: "task" },
            ],
            responseFormat: "text",
            timeoutMs: 30_000,
            kind: "engine",
            module: "inventory",
        })
    })

    it("answers no text when the generation is refused", async () => {
        const subject = await setup(jest.fn().mockResolvedValue({ ok: false, reason: "quota", message: "no" }))

        await expect(subject.generate(request)).resolves.toEqual({ ok: false, output: "" })
    })

    it("answers no text when the door throws", async () => {
        const subject = await setup(jest.fn().mockRejectedValue(new Error("down")))

        await expect(subject.generate(request)).resolves.toEqual({ ok: false, output: "" })
    })
})
