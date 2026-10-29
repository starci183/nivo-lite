import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { TextRequest } from "@modules/domain/ai-tasks"
import { GenerationsService } from "./generations.service"
import { TextGeneratorService } from "./text-generator.service"

const request = (json: boolean): TextRequest => ({
    workspaceId: "w1",
    purpose: "sales:classify",
    messages: [{ role: "user", content: "hi" }],
    json,
    kind: "classify",
    module: "sales",
})

const setup = async (): Promise<{ subject: TextGeneratorService; text: jest.Mock }> => {
    const text = jest.fn(() => Promise.resolve("answer"))
    const moduleRef = await Test.createTestingModule({
        providers: [
            TextGeneratorService,
            { provide: GenerationsService, useValue: mock<GenerationsService>({ text }) },
        ],
    }).compile()
    return { subject: moduleRef.get(TextGeneratorService), text }
}

describe("TextGeneratorService", () => {
    it("asks for plain text when the prompt wants prose", async () => {
        const { subject, text } = await setup()

        await expect(subject.generate(request(false))).resolves.toBe("answer")

        expect(text).toHaveBeenCalledWith({
            workspaceId: "w1",
            purpose: "sales:classify",
            messages: [{ role: "user", content: "hi" }],
            responseFormat: "text",
            kind: "classify",
            module: "sales",
        })
    })

    it("asks for one JSON object when the prompt wants it", async () => {
        const { subject, text } = await setup()

        await subject.generate(request(true))

        expect(text).toHaveBeenCalledWith(expect.objectContaining({ responseFormat: "json" }))
    })
})
