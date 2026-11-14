import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AiTasksService, type ModelPicker } from "@modules/domain/ai-tasks"
import { AgentModelPickerService } from "./agent-model-picker.service"

const build = async () => {
    const ai = mock<AiTasksService>({ modelPicker: jest.fn((locale: string) => mock<ModelPicker>({ defaultModel: locale })) })
    const container = await Test.createTestingModule({
        providers: [AgentModelPickerService, { provide: AiTasksService, useValue: ai }],
    }).compile()
    return { service: container.get(AgentModelPickerService), ai }
}

describe("AgentModelPickerService.picker", () => {
    it.each([
        ["en", "en"],
        ["vi", "vi"],
        ["fr", "vi"],
        [null, "vi"],
        [undefined, "vi"],
    ])("words the picker for the locale %j in %s", async (named, worded) => {
        const { service, ai } = await build()

        await expect(service.picker(named)).resolves.toMatchObject({ defaultModel: worded })
        expect(ai.modelPicker).toHaveBeenCalledWith(worded)
    })
})
