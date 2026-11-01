import { Test } from "@nestjs/testing"
import { PAYLOAD_BYTES_MAX, memberOf, payloadFits, wakeInboundOf } from "./inbound-event.policy"
import type { InboundAdapter, InboundEvent } from "./agent-inbound.contracts"

const SUBJECT = Symbol("inbound-event.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { memberOf, payloadFits, wakeInboundOf } }],
    }).compile()
    return moduleRef.get<typeof import("./inbound-event.policy")>(SUBJECT)
}

const event = (over: Partial<InboundEvent> = {}): InboundEvent => ({
    adapter: "invoice_hook",
    eventType: "invoice.paid",
    actor: { kind: "member", id: "member-1", role: "owner" },
    chain: null,
    payload: { amount: 1 },
    attachments: [{ fileId: "f-1", mimeType: "image/png" }],
    evidence: [{ key: "k", value: 1, kind: "fact", via: "x" }],
    idempotencyKey: "key-1",
    workspaceId: "ws-1",
    agentId: null,
    scopeKey: null,
    ...over,
})

const adapter: InboundAdapter = {
    key: "invoice_hook",
    authentication: "session",
    trustOf: (actor) => (actor.role === "owner" ? "manager" : "member"),
    awaitsAnswer: false,
    replyStep: null,
    doorStep: "door",
    priority: 25,
    maxAttempts: 3,
}

describe("payloadFits", () => {
    it("accepts a payload up to the bytes a wake keeps and refuses a larger one", async () => {
        const { payloadFits } = await buildSubject()

        expect(payloadFits({ text: "x" })).toBe(true)
        expect(payloadFits({ text: "x".repeat(PAYLOAD_BYTES_MAX) })).toBe(false)
    })

    it("counts bytes, not characters", async () => {
        const { payloadFits } = await buildSubject()

        const threeBytes = String.fromCharCode(0x1ebf)

        expect(payloadFits({ text: threeBytes.repeat(Math.ceil(PAYLOAD_BYTES_MAX / 3)) })).toBe(false)
    })
})

describe("wakeInboundOf", () => {
    it("keeps the event as the wake carries it, with the trust the adapter derives for the actor and the chain of this wake", async () => {
        const { wakeInboundOf } = await buildSubject()
        const chain = { id: "c-1", depth: 1, agentIds: ["agent-1"], cause: null }

        expect(wakeInboundOf(event(), adapter, chain)).toEqual({
            eventType: "invoice.paid",
            actor: { kind: "member", id: "member-1", role: "owner" },
            trust: "manager",
            chain,
            payload: { amount: 1 },
            attachments: [{ fileId: "f-1", mimeType: "image/png" }],
            evidence: [{ key: "k", value: 1, kind: "fact", via: "x" }],
        })
    })
})

describe("memberOf", () => {
    it("is the actor when it is a member and nobody for any other kind", async () => {
        const { memberOf } = await buildSubject()

        expect(memberOf(event())).toBe("member-1")
        expect(memberOf(event({ actor: { kind: "agent", id: "agent-1", role: null } }))).toBeNull()
        expect(memberOf(event({ actor: { kind: "member", id: null, role: null } }))).toBeNull()
    })
})
