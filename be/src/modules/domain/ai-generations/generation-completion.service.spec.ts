import { Test } from "@nestjs/testing"
import { GenerationCompletionService } from "./generation-completion.service"

describe("GenerationCompletionService", () => {
    it("has no further effect for a generic generated text", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [GenerationCompletionService] }).compile()

        await expect(moduleRef.get(GenerationCompletionService).completeGeneration()).resolves.toBeUndefined()
    })
})
