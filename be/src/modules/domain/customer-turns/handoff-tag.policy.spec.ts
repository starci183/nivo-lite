import { Test } from "@nestjs/testing"
import { handoffTagGranted } from "./handoff-tag.policy"
import type { AgentCard } from "@modules/domain/agents"

const card = (id: string, module: string, canTagAgentIds: ReadonlyArray<string> = []): AgentCard => ({
    id,
    name: id,
    module,
    canTagAgentIds,
})

const SUBJECT = Symbol("handoff-tag.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { handoffTagGranted } }],
    }).compile()
    return moduleRef.get<typeof import("./handoff-tag.policy")>(SUBJECT)
}

describe("handoffTagGranted", () => {
    let policy: typeof import("./handoff-tag.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("grants a chat agent that may tag a Sales agent", () => {
        expect(policy.handoffTagGranted("chat", [card("chat", "chatbot", ["sales"]), card("sales", "sales")])).toBe(
            true,
        )
    })

    it("grants the Sales agent that holds the chat itself", () => {
        expect(policy.handoffTagGranted("sales", [card("sales", "sales")])).toBe(true)
    })

    it("denies a chat agent with no tag right, with no Sales agent or one that is unknown", () => {
        expect(policy.handoffTagGranted("chat", [card("chat", "chatbot"), card("sales", "sales")])).toBe(false)
        expect(policy.handoffTagGranted("chat", [card("chat", "chatbot", ["sales"])])).toBe(false)
        expect(policy.handoffTagGranted("gone", [card("sales", "sales")])).toBe(false)
    })
})
