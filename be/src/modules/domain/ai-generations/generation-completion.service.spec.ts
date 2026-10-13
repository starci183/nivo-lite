import { Test } from "@nestjs/testing"
import { GenerationCompletionService } from "./generation-completion.service"

describe("GenerationCompletionService", () => {
    it("finishes a generic text with no further domain effect", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [GenerationCompletionService],
        }).compile()
        const service = moduleRef.get(GenerationCompletionService)

        await expect(service.completeGeneration()).resolves.toBeUndefined()
    })
})
