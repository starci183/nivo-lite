import { Test } from "@nestjs/testing"
import { clipped, rowOf } from "./inbox-lead-row.policy"
import type { AgentMark, LeadFacts, OrderFacts } from "./inbox-lead-row.policy"

const POLICY = Symbol("./inbox-lead-row.policy")
type PolicySubject = {
    clipped: typeof clipped
    rowOf: typeof rowOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { clipped, rowOf } }],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(POLICY)
    return { subject }
}

const order = (over: Partial<OrderFacts>): OrderFacts => ({
    id: "o1",
    orderNo: "DH-1",
    status: "draft",
    amountVnd: 4000,
    isShipped: false,
    itemsText: "roses",
    note: null,
    createdAt: "2026-11-09T07:00:00.000Z",
    updatedAt: "2026-11-09T07:00:00.000Z",
    ...over,
})

const facts = (over: Partial<LeadFacts>): LeadFacts => ({
    id: "l1",
    name: "An",
    channel: "zalo",
    via: null,
    leadStage: "new",
    need: null,
    contextSummary: null,
    quoteVnd: null,
    nextStep: null,
    ownerAgentId: null,
    orders: [],
    hasMatchedPayment: false,
    conversation: null,
    waitingWork: 0,
    firstAt: "2026-11-09T07:00:00.000Z",
    lastAt: "2026-11-09T07:00:00.000Z",
    eventCount: 1,
    lastBody: "",
    isUnmatched: false,
    ...over,
})

const AGENTS: ReadonlyMap<string, AgentMark> = new Map([["a1", { name: "Sales", avatarUrl: null }]])

describe("inbox lead row", () => {
    it("shortens a long summary onto one line", async () => {
        const { subject } = await buildSubject()
        const { clipped } = subject
        expect(clipped("a   b\n c")).toBe("a b c")
        expect(clipped("x".repeat(400))).toHaveLength(160)
    })

    it("asks the owner when a draft order waits, and shows the draft value", async () => {
        const { subject } = await buildSubject()
        const { rowOf } = subject
        const row = rowOf(facts({ orders: [order({})], ownerAgentId: "a1" }), AGENTS)
        expect(row.needsOwner).toBe(true)
        expect(row.chips).toEqual(["needs_you", "new"])
        expect(row.amountVnd).toBe(4000)
        expect(row.agentName).toBe("Sales")
    })

    it("asks the owner when the agent handed the conversation over or a decision waits", async () => {
        const { subject } = await buildSubject()
        const { rowOf } = subject
        expect(rowOf(facts({ waitingWork: 1 }), AGENTS).needsOwner).toBe(true)
        const handed = facts({ conversation: { agentId: null, status: "needs", lastText: "hi", channel: "zalo" } })
        expect(rowOf(handed, AGENTS).needsOwner).toBe(true)
    })

    it("marks a confirmed order as awaiting its payment and a matched credit as paid", async () => {
        const { subject } = await buildSubject()
        const { rowOf } = subject
        expect(rowOf(facts({ orders: [order({ status: "confirmed" })] }), AGENTS).chips).toEqual(["awaiting_payment"])
        expect(rowOf(facts({ orders: [order({ status: "paid" })] }), AGENTS).stage).toBe("paid")
    })

    it("draws an unclaimed credit as unmatched money in", async () => {
        const { subject } = await buildSubject()
        const { rowOf } = subject
        const row = rowOf(facts({ isUnmatched: true, leadStage: null, quoteVnd: 1080000 }), AGENTS)
        expect(row.chips).toEqual(["unmatched"])
        expect(row.stage).toBe("paid")
        expect(row.amountVnd).toBe(1080000)
    })

    it("takes the summary from the lead, else its need, else the last words", async () => {
        const { subject } = await buildSubject()
        const { rowOf } = subject
        expect(rowOf(facts({ contextSummary: "summary", need: "need" }), AGENTS).summary).toBe("summary")
        expect(rowOf(facts({ need: "need" }), AGENTS).summary).toBe("need")
        expect(rowOf(facts({ lastBody: "last words" }), AGENTS).summary).toBe("last words")
    })

    it("names no agent that the workspace does not know", async () => {
        const { subject } = await buildSubject()
        const { rowOf } = subject
        const row = rowOf(facts({ ownerAgentId: "gone" }), AGENTS)
        expect(row.agentId).toBeNull()
        expect(row.agentName).toBeNull()
    })
})
