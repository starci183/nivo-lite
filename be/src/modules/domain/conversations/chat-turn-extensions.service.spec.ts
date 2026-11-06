import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChatTurnExtensionsService } from "./chat-turn-extensions.service"
import type { CustomerOutcomes } from "./conversations.contracts"
import { CHAT_TURN_OUTCOMES } from "./conversations.decorators"

describe("ChatTurnExtensionsService", () => {
    it("answers the outcome handler the app root plugged in", async () => {
        const outcomes = mock<CustomerOutcomes>()
        const moduleRef = await Test.createTestingModule({
            providers: [ChatTurnExtensionsService, { provide: CHAT_TURN_OUTCOMES, useValue: outcomes }],
        }).compile()

        expect(moduleRef.get(ChatTurnExtensionsService).outcomes()).toBe(outcomes)
    })

    it("answers none when the app root plugged none in", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [ChatTurnExtensionsService] }).compile()

        expect(moduleRef.get(ChatTurnExtensionsService).outcomes()).toBeUndefined()
    })
})
