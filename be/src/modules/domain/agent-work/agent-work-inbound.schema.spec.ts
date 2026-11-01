import { wakeInboundSchema } from "./agent-work-inbound.schema"

const valid = {
    eventType: "invoice.paid",
    actor: { kind: "member", id: "member-1", role: "manager" },
    trust: "manager",
    chain: null,
    payload: { amount: 1 },
    attachments: [],
    evidence: [{ key: "k", value: true, kind: "fact", via: "tag" }],
}

describe("wakeInboundSchema", () => {
    it("accepts a normalized event and its chain", () => {
        const chain = { id: "chain-1", depth: 2, agentIds: ["agent-1", "agent-2"], cause: "new quote" }

        expect(wakeInboundSchema.safeParse(valid).success).toBe(true)
        expect(wakeInboundSchema.safeParse({ ...valid, chain }).success).toBe(true)
    })

    it.each([
        ["an unknown field", { ...valid, extra: 1 }],
        ["an empty event type", { ...valid, eventType: "" }],
        ["a chain deeper than any limit", { ...valid, chain: { id: "c", depth: 1001, agentIds: [], cause: null } }],
        [
            "evidence of another value kind",
            { ...valid, evidence: [{ key: "k", value: null, kind: "fact", via: "tag" }] },
        ],
        ["a payload that is not an object", { ...valid, payload: [1] }],
    ])("refuses %s", (_name, value) => {
        expect(wakeInboundSchema.safeParse(value).success).toBe(false)
    })
})
