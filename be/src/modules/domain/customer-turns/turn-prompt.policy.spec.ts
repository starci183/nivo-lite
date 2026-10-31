import { Test } from "@nestjs/testing"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { channelKeyOf, personaOf, turnMessageOf, turnSystemOf } from "./turn-prompt.policy"
const SUBJECT = Symbol("turn-prompt.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { personaOf, turnSystemOf, turnMessageOf, channelKeyOf } }],
    }).compile()
    return moduleRef.get<typeof import("./turn-prompt.policy")>(SUBJECT)
}

const agent: TurnConversation["agent"] = {
    id: "a1",
    name: "Bot",
    handle: "bot",
    role: "Chatbot",
    module: "chatbot",
    instructions: "Be brief.",
    knowledge: "",
    approvalRule: "",
    greeting: "",
}

describe("personaOf", () => {
    it("fills the empty knowledge and approval rule", async () => {
        const subject = await build()

        expect(subject.personaOf(agent, null)).toBe(
            `You are Bot (@bot), role: Chatbot.
Instructions: Be brief.
Business knowledge: (none)
Approval rule: Commitments need human approval.`,
        )
    })

    it("keeps the knowledge and approval rule the owner wrote", async () => {
        const subject = await build()

        expect(subject.personaOf({ ...agent, knowledge: "Tea is 50k", approvalRule: "Ask over 1m" }, null)).toContain(
            "Business knowledge: Tea is 50k\nApproval rule: Ask over 1m",
        )
    })
})

describe("personaOf after a hand-over", () => {
    it("keeps the speaker's role and instructions under the name of the front agent, without its handle", async () => {
        const subject = await build()

        const persona = subject.personaOf({ ...agent, name: "Sales AI", handle: "sales-ai", role: "Sales" }, "Bot")

        expect(persona).toContain("You are Bot, role: Sales.")
        expect(persona).toContain("Instructions: Be brief.")
        expect(persona).not.toContain("Sales AI")
        expect(persona).not.toContain("@sales-ai")
    })
})

describe("turnSystemOf", () => {
    it("joins the non-empty parts and drops a blank extra", async () => {
        const subject = await build()

        const system = subject.turnSystemOf({
            persona: "persona",
            authority: "\nauthority",
            recall: "recall",
            extras: ["", "jobs"],
            contract: "contract",
        })
        expect(system.startsWith("You work inside NIVO OS")).toBe(true)
        expect(system).toContain("persona\nauthority")
        expect(system).toContain("recall\n\njobs\n\ncontract")
        expect(system.endsWith("Answer with ONLY the JSON object of the reply contract.")).toBe(true)
        expect(system.includes("\n\n\n\n")).toBe(false)
    })
})

describe("turnMessageOf", () => {
    it("says the conversation is starting when there is no earlier line", async () => {
        const subject = await build()

        expect(subject.turnMessageOf("system", [{ role: "user", body: "Hi" }], "Hi")).toContain(
            "[CONVERSATION SO FAR]\n(this is the first message)\n\n[CUSTOMER LATEST MESSAGE]\nHi",
        )
    })

    it("keeps the last 19 earlier lines and labels who spoke", async () => {
        const subject = await build()

        const transcript = Array.from({ length: 22 }, (_, index) => ({
            role: index % 2 === 0 ? ("user" as const) : ("agent" as const),
            body: `m${index}`,
        }))
        const message = subject.turnMessageOf("system", transcript, "latest")
        expect(message.startsWith("[NIVO CONTEXT: authoritative; follow it exactly]\nsystem")).toBe(true)
        expect(message).toContain("Customer: m2")
        expect(message).toContain("You: m3")
        expect(message).not.toContain("m0")
        expect(message).not.toContain("m21")
        expect(message.endsWith("[CUSTOMER LATEST MESSAGE]\nlatest")).toBe(true)
    })
})

describe("channelKeyOf", () => {
    it.each(["telegram", "facebook", "instagram", "zalo"] as const)("keeps %s", async (channel) => {
        const subject = await build()

        expect(subject.channelKeyOf(channel)).toBe(channel)
    })

    it("treats any other channel as the website chat", async () => {
        const subject = await build()

        expect(subject.channelKeyOf("website")).toBe("website")
        expect(subject.channelKeyOf("sms")).toBe("website")
    })
})
