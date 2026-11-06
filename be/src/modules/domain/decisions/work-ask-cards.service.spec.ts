import { Test } from "@nestjs/testing"
import { NoAskCardsService } from "./work-ask-cards.service"

describe("NoAskCardsService", () => {
    it("holds no approval card for any decision", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [NoAskCardsService] }).compile()
        await expect(moduleRef.get(NoAskCardsService).cardsOf()).resolves.toBe(0)
    })
})
