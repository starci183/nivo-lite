import type { TurnConversation } from "@modules/domain/agent-conversations"
import { channelKeyOf, personaOf, turnMessageOf, turnSystemOf } from "./turn-prompt.policy"

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
    it("fills the empty knowledge and approval rule", () => {
        expect(personaOf(agent)).toBe(
            `You are Bot (@bot), role: Chatbot.
Instructions: Be brief.
Business knowledge: (none)
Approval rule: Commitments need human approval.`,
        )
    })

    it("keeps the knowledge and approval rule the owner wrote", () => {
        expect(personaOf({ ...agent, knowledge: "Tea is 50k", approvalRule: "Ask over 1m" })).toContain(
            "Business knowledge: Tea is 50k\nApproval rule: Ask over 1m",
        )
    })
})

describe("turnSystemOf", () => {
    it("joins the non-empty parts and drops a blank extra", () => {
        const system = turnSystemOf({
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
    it("says the conversation is starting when there is no earlier line", () => {
        expect(turnMessageOf("system", [{ role: "user", body: "Hi" }], "Hi")).toContain(
            "[CONVERSATION SO FAR]\n(this is the first message)\n\n[CUSTOMER LATEST MESSAGE]\nHi",
        )
    })

    it("keeps the last 19 earlier lines and labels who spoke", () => {
        const transcript = Array.from({ length: 22 }, (_, index) => ({
            role: index % 2 === 0 ? ("user" as const) : ("agent" as const),
            body: `m${index}`,
        }))
        const message = turnMessageOf("system", transcript, "latest")
        expect(message.startsWith("[NIVO CONTEXT: authoritative; follow it exactly]\nsystem")).toBe(true)
        expect(message).toContain("Customer: m2")
        expect(message).toContain("You: m3")
        expect(message).not.toContain("m0")
        expect(message).not.toContain("m21")
        expect(message.endsWith("[CUSTOMER LATEST MESSAGE]\nlatest")).toBe(true)
    })
})

describe("channelKeyOf", () => {
    it.each(["telegram", "facebook", "instagram", "zalo"] as const)("keeps %s", (channel) => {
        expect(channelKeyOf(channel)).toBe(channel)
    })

    it("treats any other channel as the website chat", () => {
        expect(channelKeyOf("website")).toBe("website")
        expect(channelKeyOf("sms")).toBe("website")
    })
})
