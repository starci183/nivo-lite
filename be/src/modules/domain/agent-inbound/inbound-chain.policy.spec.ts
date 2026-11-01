import { Test } from "@nestjs/testing"
import { CHAIN_DEPTH_MAX, stepChain } from "./inbound-chain.policy"
import type { InboundChain } from "./agent-inbound.contracts"

const SUBJECT = Symbol("inbound-chain.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { stepChain } }],
    }).compile()
    return moduleRef.get<typeof import("./inbound-chain.policy")>(SUBJECT)
}

const chain = (over: Partial<InboundChain> = {}): InboundChain => ({
    id: "chain-1",
    depth: 1,
    agentIds: ["agent-1"],
    cause: null,
    ...over,
})

describe("stepChain", () => {
    it("starts a chain of one for an event no agent led to", async () => {
        const { stepChain } = await buildSubject()

        expect(stepChain(null, "agent-1", () => "new-chain")).toEqual({
            kind: "go",
            chain: { id: "new-chain", depth: 1, agentIds: ["agent-1"], cause: null },
        })
    })

    it("adds an agent that is not in the chain yet and counts one more wake", async () => {
        const { stepChain } = await buildSubject()

        expect(stepChain(chain(), "agent-2", () => "unused")).toEqual({
            kind: "go",
            chain: { id: "chain-1", depth: 2, agentIds: ["agent-1", "agent-2"], cause: null },
        })
    })

    it("stops at the depth limit and keeps the chain it stopped on", async () => {
        const { stepChain } = await buildSubject()
        const deep = chain({ depth: CHAIN_DEPTH_MAX })

        expect(stepChain(deep, "agent-9", () => "unused")).toEqual({ kind: "stop", reason: "depth_limit", chain: deep })
    })

    it("stops an agent already in the chain when the event brings no new cause", async () => {
        const { stepChain } = await buildSubject()
        const looped = chain({ agentIds: ["agent-1", "agent-2"], depth: 2 })

        expect(stepChain(looped, "agent-1", () => "unused")).toEqual({
            kind: "stop",
            reason: "agent_in_chain",
            chain: looped,
        })
    })

    it("wakes an agent already in the chain again for a new cause, without adding it twice, and still counts the depth", async () => {
        const { stepChain } = await buildSubject()
        const again = chain({ agentIds: ["agent-1", "agent-2"], depth: 2, cause: "customer sent a new quote" })

        expect(stepChain(again, "agent-1", () => "unused")).toEqual({
            kind: "go",
            chain: { id: "chain-1", depth: 3, agentIds: ["agent-1", "agent-2"], cause: "customer sent a new quote" },
        })
    })

    it("stops a new cause too once the depth limit is reached, so no cause can run a chain for ever", async () => {
        const { stepChain } = await buildSubject()
        const deep = chain({ depth: CHAIN_DEPTH_MAX, cause: "again" })

        expect(stepChain(deep, "agent-1", () => "unused")).toMatchObject({ kind: "stop", reason: "depth_limit" })
    })
})
