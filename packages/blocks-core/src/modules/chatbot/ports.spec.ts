import { CONVERSATIONS, MESSAGES, THREADS_LIST } from "./ports"

describe("the ports of the Chatbot module", () => {
    it("bind the two entities to the engine and name the inbox list source", () => {
        expect(CONVERSATIONS.id).toBe("engine.entity.chat.conversation")
        expect(MESSAGES.id).toBe("engine.entity.chat.message")
        expect(THREADS_LIST.id).toBe("chatbot.threads-list")
    })
})
