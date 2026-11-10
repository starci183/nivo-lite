import { agentTagEffect, coreDataKinds, coreEffects, coreTools } from "./index"

describe("core vocabulary", () => {
    it("names each data kind, effect and tool once", () => {
        const ids = [
            ...coreDataKinds.map((kind) => kind.kind),
            ...coreEffects.map((e) => e.id),
            ...coreTools.map((t) => t.id),
        ]
        expect(new Set(ids).size).toBe(ids.length)
    })

    it("tags exactly one agent, by id or by module", () => {
        expect(agentTagEffect.payload.safeParse({ toAgentId: "a", text: "hi" }).success).toBe(true)
        expect(agentTagEffect.payload.safeParse({ toModuleKey: "sales", text: "hi" }).success).toBe(true)
        expect(agentTagEffect.payload.safeParse({ text: "hi" }).success).toBe(false)
        expect(agentTagEffect.payload.safeParse({ toAgentId: "a", toModuleKey: "s", text: "hi" }).success).toBe(false)
        expect(agentTagEffect.payload.safeParse({ toAgentId: "a", text: "hi", visibility: "redirect" }).success).toBe(
            true,
        )
        expect(agentTagEffect.payload.safeParse({ toAgentId: "a", text: "hi", visibility: "page" }).success).toBe(false)
    })
})
