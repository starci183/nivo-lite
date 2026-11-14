import { CONVERSATIONS, NOTES, THREADS_LIST } from "./ports"

describe("the ports of the Chatbot module", () => {
    it("bind the chat and its notes to the engine (no line record: the lines are the engine's, R26) and name the inbox list source", () => {
        expect(CONVERSATIONS.id).toBe("engine.entity.blocks-core.chatbot.chat")
        expect(NOTES.id).toBe("engine.entity.blocks-core.chatbot.note")
        expect(THREADS_LIST.id).toBe("chatbot.threads-list")
    })
})
