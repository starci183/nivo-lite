import { Test } from "@nestjs/testing"
import { runtimeTurn } from "@tests/fixtures/builders/customer-turn-runtime.builder"
import type { CustomerTurn } from "@modules/domain/conversations"
import { intentContextOf } from "./customer-intent.policy"

const SUBJECT = Symbol("customer-intent.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { intentContextOf } }],
    }).compile()
    return moduleRef.get<{ intentContextOf: typeof intentContextOf }>(SUBJECT)
}

const turnOf = (
    over: Partial<CustomerTurn["conversation"]["agent"]> = {},
    speaksAs: string | null = null,
): CustomerTurn => ({
    ...runtimeTurn,
    conversation: { ...runtimeTurn.conversation, agent: { ...runtimeTurn.conversation.agent, ...over }, speaksAs },
    transcript: [
        { role: "user", body: "Hello" },
        { role: "agent", body: "Hi, how can I help?" },
        { role: "user", body: "How much is the tea?" },
    ],
})

describe("intentContextOf", () => {
    it("keeps who the agent is as one trusted line and every other word as data, in reading order", async () => {
        const policy = await build()
        const { identity, input } = policy.intentContextOf(
            turnOf({ instructions: "Be brief", knowledge: "Tea 50k", approvalRule: "Ask first" }),
            "AUTHORITY",
            ["JOBS", "", "LOYALTY"],
        )

        expect(identity).toBe("You are Bot (@bot), role: Chatbot.")
        expect(identity).not.toContain("\n")
        expect(input.map((part) => part.kind)).toEqual([
            "owner_instructions",
            "authority",
            "shop_facts",
            "transcript",
            "customer_message",
        ])
        expect(input[0]?.text).toBe("Instructions: Be brief\nBusiness knowledge: Tea 50k\nApproval rule: Ask first")
        expect(input[1]?.text).toBe("AUTHORITY")
        expect(input[2]?.text).toBe("JOBS\n\nLOYALTY")
        expect(input[3]?.text).toBe("Customer: Hello\nYou: Hi, how can I help?")
        expect(input[4]?.text).toBe("How much is the tea?")
    })

    it("answers under the name of the front agent after a hand-over", async () => {
        const policy = await build()
        const { identity } = policy.intentContextOf(turnOf({}, "Front Agent"), "", [])

        expect(identity).toBe("You are Front Agent, role: Chatbot.")
    })

    it("leaves out a part with nothing to say, and keeps only the latest message of a first conversation", async () => {
        const policy = await build()
        const first: CustomerTurn = { ...turnOf(), transcript: [{ role: "user", body: "How much is the tea?" }] }

        const { input } = policy.intentContextOf(first, "  ", [""])

        expect(input.map((part) => part.kind)).toEqual(["owner_instructions", "customer_message"])
    })

    it("carries only the last twenty messages of a long conversation", async () => {
        const policy = await build()
        const transcript = Array.from({ length: 30 }, (_, index) => ({
            role: "user" as const,
            body: `m${String(index)}`,
        }))

        const { input } = policy.intentContextOf({ ...turnOf(), transcript }, "", [])

        const earlier = input.find((part) => part.kind === "transcript")?.text.split("\n") ?? []
        expect(earlier).toHaveLength(19)
        expect(earlier[0]).toBe("Customer: m10")
    })
})
