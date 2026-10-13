import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChatTurnExtensionsService } from "./chat-turn-extensions.service"
import type { ChatTurnRuntime, CustomerOutcomes } from "./conversations.contracts"

const build = async (): Promise<ChatTurnExtensionsService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [ChatTurnExtensionsService],
    }).compile()
    return moduleRef.get(ChatTurnExtensionsService)
}

describe("ChatTurnExtensionsService", () => {
    it("has neither the AI step nor the outcome handler until an owner registers them", async () => {
        const extensions = await build()

        expect(extensions.runtime()).toBeUndefined()
        expect(extensions.outcomes()).toBeUndefined()
    })

    it("answers what was registered and lets a later registration replace it", async () => {
        const extensions = await build()
        const second = mock<ChatTurnRuntime>()
        const outcomes = mock<CustomerOutcomes>()

        extensions.useRuntime(mock<ChatTurnRuntime>())
        extensions.useRuntime(second)
        extensions.useOutcomes(outcomes)

        expect(extensions.runtime()).toBe(second)
        expect(extensions.outcomes()).toBe(outcomes)
    })
})
