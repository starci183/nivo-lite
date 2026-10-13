import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChatTurnExtensionsService } from "./chat-turn-extensions.service"
import type { ChatTurnRuntime, CustomerOutcomes } from "./conversations.contracts"
import { CHAT_TURN_OUTCOMES, CHAT_TURN_RUNTIME } from "./conversations.decorators"

describe("ChatTurnExtensionsService", () => {
    it("answers what the app root plugged in", async () => {
        const runtime = mock<ChatTurnRuntime>()
        const outcomes = mock<CustomerOutcomes>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                ChatTurnExtensionsService,
                { provide: CHAT_TURN_RUNTIME, useValue: runtime },
                { provide: CHAT_TURN_OUTCOMES, useValue: outcomes },
            ],
        }).compile()
        const extensions = moduleRef.get(ChatTurnExtensionsService)

        expect(extensions.runtime()).toBe(runtime)
        expect(extensions.outcomes()).toBe(outcomes)
    })
})
