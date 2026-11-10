import { Test } from "@nestjs/testing"
import type { ConversationLeadsGate, GatewayRun, NativeCaller } from "../mcp-gateway.contracts"
import { pinRefusalOf } from "./effect-pin.policy"

/** The members of the subject under test. */
interface Subject {
    readonly pinRefusalOf: typeof pinRefusalOf
}

const SUBJECT = Symbol("effect-pin.policy")

/** The policy function, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { pinRefusalOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const RUN: GatewayRun = {
    turnId: "run-1",
    locale: "vi",
    origin: "system",
    memberId: null,
    handedOffBy: null,
    leadId: null,
    stepTools: [],
}

/** The lead of each conversation the gate knows. */
const LEADS: ReadonlyMap<string, string> = new Map([
    ["conv-1", "lead-1"],
    ["conv-2", "lead-2"],
])

/** A gate that knows conv-1 of lead-1 and conv-2 of lead-2. */
const GATE: ConversationLeadsGate = {
    leadOf: (_workspaceId, conversationId) => Promise.resolve(LEADS.get(conversationId) ?? null),
}

const IN_CONVERSATION: NativeCaller = { agentId: "a", conversationId: "conv-1", run: RUN }
const OF_LEAD: NativeCaller = { agentId: "a", conversationId: null, run: { ...RUN, leadId: "lead-1" } }
const OF_SYSTEM: NativeCaller = { agentId: "a", conversationId: null, run: RUN }

describe("effect-pin.policy", () => {
    it("keeps a run that serves a conversation to that conversation and its lead", async () => {
        const subject = await build()

        await expect(
            subject.pinRefusalOf(GATE, "ws-1", IN_CONVERSATION, { conversationId: "conv-1", text: "hi" }),
        ).resolves.toBeNull()
        await expect(subject.pinRefusalOf(GATE, "ws-1", IN_CONVERSATION, { conversationId: "conv-2" })).resolves.toBe(
            "conversation_mismatch",
        )
        await expect(subject.pinRefusalOf(GATE, "ws-1", IN_CONVERSATION, { leadId: "lead-1" })).resolves.toBeNull()
        await expect(subject.pinRefusalOf(GATE, "ws-1", IN_CONVERSATION, { leadId: "lead-2" })).resolves.toBe(
            "lead_mismatch",
        )
    })

    it("does not judge the lead of a conversation run when no gate says it", async () => {
        const subject = await build()

        await expect(subject.pinRefusalOf(null, "ws-1", IN_CONVERSATION, { leadId: "lead-2" })).resolves.toBeNull()
    })

    it("keeps a run with a lead and no conversation to that lead and its conversations", async () => {
        const subject = await build()

        await expect(subject.pinRefusalOf(GATE, "ws-1", OF_LEAD, { leadId: "lead-1" })).resolves.toBeNull()
        await expect(subject.pinRefusalOf(GATE, "ws-1", OF_LEAD, { leadId: "lead-2" })).resolves.toBe("lead_mismatch")
        await expect(subject.pinRefusalOf(GATE, "ws-1", OF_LEAD, { conversationId: "conv-1" })).resolves.toBeNull()
        await expect(subject.pinRefusalOf(GATE, "ws-1", OF_LEAD, { conversationId: "conv-2" })).resolves.toBe(
            "conversation_mismatch",
        )
        await expect(subject.pinRefusalOf(null, "ws-1", OF_LEAD, { conversationId: "conv-1" })).resolves.toBe(
            "conversation_unverified",
        )
    })

    it("does not pin a system run with neither a conversation nor a lead", async () => {
        const subject = await build()

        await expect(
            subject.pinRefusalOf(null, "ws-1", OF_SYSTEM, { conversationId: "conv-2", leadId: "lead-2" }),
        ).resolves.toBeNull()
    })
})
