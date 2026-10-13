import { mock } from "@starci/jest-preset"
import { ChatTurnExtensionsService } from "./chat-turn-extensions.service"
import type { ChatTurnRuntime, CustomerOutcomes } from "./conversations.contracts"

describe("ChatTurnExtensionsService", () => {
    it("has neither the AI step nor the outcome handler until an owner registers them", () => {
        const extensions = new ChatTurnExtensionsService()

        expect(extensions.runtime()).toBeUndefined()
        expect(extensions.outcomes()).toBeUndefined()
    })

    it("answers what was registered and lets a later registration replace it", () => {
        const extensions = new ChatTurnExtensionsService()
        const second = mock<ChatTurnRuntime>()
        const outcomes = mock<CustomerOutcomes>()

        extensions.useRuntime(mock<ChatTurnRuntime>())
        extensions.useRuntime(second)
        extensions.useOutcomes(outcomes)

        expect(extensions.runtime()).toBe(second)
        expect(extensions.outcomes()).toBe(outcomes)
    })
})
