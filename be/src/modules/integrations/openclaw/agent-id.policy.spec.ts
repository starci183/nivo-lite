import { agentIdFor, threadKeyFor } from "./agent-id.policy"

describe("agent ids", () => {
    it("derives one agent per workspace and module", () => {
        expect(agentIdFor("0123abcd-0000-4000-8000-000000000000", "Chat_Bot!")).toBe("ws-0123abcd-chatbot")
    })

    it("derives the thread key inside an agent", () => {
        expect(threadKeyFor("ws-0123abcd-chatbot", "conv-1")).toBe("agent:ws-0123abcd-chatbot:conv-1")
    })
})
