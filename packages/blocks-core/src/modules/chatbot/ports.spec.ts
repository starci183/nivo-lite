import { CONVERSATIONS, DOOR, LEADS, MEMBERS, MESSAGES, OUTBOX, THREADS_LIST } from "./ports"

describe("the ports of the Chatbot module", () => {
    it("are registered under ids of the module, one each", () => {
        const ids = [THREADS_LIST, CONVERSATIONS, MESSAGES, MEMBERS, LEADS, OUTBOX, DOOR].map((port) => port.id)
        expect(ids.every((id) => id.startsWith("chatbot."))).toBe(true)
        expect(new Set(ids).size).toBe(ids.length)
    })
})
