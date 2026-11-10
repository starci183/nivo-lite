import { Test } from "@nestjs/testing"
import { agentReasoningOf, agentToolChoiceOf, agentTurnMetaOf } from "./agent-turn.policy"

const SUBJECT = Symbol("agent-turn.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { agentReasoningOf, agentToolChoiceOf, agentTurnMetaOf } }],
    }).compile()
    return moduleRef.get<typeof import("./agent-turn.policy")>(SUBJECT)
}

describe("agent turn policy", () => {
    it("takes the node's own reasoning over the app's setting, and the model's default when neither says", async () => {
        const policy = await build()

        expect(policy.agentReasoningOf({ nodeReasoning: "low" }, { purpose: "sales.consult:agent", reasoning: "medium" })).toBe("medium")
        expect(policy.agentReasoningOf({ nodeReasoning: "low" }, { purpose: "sales.consult:agent" })).toBe("low")
        expect(policy.agentReasoningOf({}, { purpose: "sales.consult:agent" })).toBe("default")
    })

    it("forces a tool call only on a step whose reasoning is off: forcing it switches the model's reasoning off", async () => {
        const policy = await build()

        expect(policy.agentToolChoiceOf("off")).toBe("required")
        for (const reasoning of ["minimal", "low", "medium", "high", "default"] as const) {
            expect(policy.agentToolChoiceOf(reasoning)).toBe("auto")
        }
    })

    it("meters the turns as engine work of the node's namespace", async () => {
        const policy = await build()

        expect(policy.agentTurnMetaOf({ purpose: "accounting.match-payment:agent" })).toEqual({
            kind: "engine",
            module: "accounting",
        })
    })
})
