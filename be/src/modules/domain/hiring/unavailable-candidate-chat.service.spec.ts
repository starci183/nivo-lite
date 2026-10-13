import { Test } from "@nestjs/testing"
import { UnavailableCandidateChatService } from "./unavailable-candidate-chat.service"

describe("UnavailableCandidateChatService", () => {
    it("reports that no candidate message was delivered", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnavailableCandidateChatService],
        }).compile()
        const service = moduleRef.get(UnavailableCandidateChatService)

        await expect(service.deliver()).resolves.toBe(false)
    })
})
