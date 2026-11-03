import type { AgentCard } from "@modules/domain/agents"
import { handoffTagGranted } from "./handoff-tag.policy"

const card = (id: string, module: string, canTagAgentIds: ReadonlyArray<string> = []): AgentCard => ({
    id,
    name: id,
    module,
    canTagAgentIds,
})

describe("handoffTagGranted", () => {
    it("grants a chat agent that may tag a Sales agent", () => {
        expect(handoffTagGranted("chat", [card("chat", "chatbot", ["sales"]), card("sales", "sales")])).toBe(true)
    })

    it("grants the Sales agent that holds the chat itself", () => {
        expect(handoffTagGranted("sales", [card("sales", "sales")])).toBe(true)
    })

    it("denies a chat agent with no tag right, with no Sales agent or one that is unknown", () => {
        expect(handoffTagGranted("chat", [card("chat", "chatbot"), card("sales", "sales")])).toBe(false)
        expect(handoffTagGranted("chat", [card("chat", "chatbot", ["sales"])])).toBe(false)
        expect(handoffTagGranted("gone", [card("sales", "sales")])).toBe(false)
    })
})
