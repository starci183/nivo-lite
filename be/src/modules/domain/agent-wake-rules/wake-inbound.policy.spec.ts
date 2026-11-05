import { Test } from "@nestjs/testing"
import { decodeInbound, encodeInbound } from "./wake-inbound.policy"
import type { AgentWakeInbound } from "./agent-wake-rules.contracts"

const SUBJECT = Symbol("wake-inbound.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { decodeInbound, encodeInbound } }],
    }).compile()
    return moduleRef.get<typeof import("./wake-inbound.policy")>(SUBJECT)
}

const inbound = (over: Partial<AgentWakeInbound> = {}): AgentWakeInbound => ({
    eventType: "invoice.paid",
    actor: { kind: "webhook", id: "conn-1", role: null },
    trust: "outsider",
    chain: { id: "chain-1", depth: 1, agentIds: ["agent-1"], cause: null },
    payload: { amount: 120, note: "paid" },
    attachments: [{ fileId: "file-1", mimeType: "application/pdf" }],
    evidence: [{ key: "endpoint", value: "conn-1", kind: "connection", via: "generic_webhook" }],
    ...over,
})

describe("encodeInbound and decodeInbound", () => {
    it("reads back the event it wrote", async () => {
        const { encodeInbound, decodeInbound } = await buildSubject()

        expect(decodeInbound(encodeInbound(inbound()))).toEqual(inbound())
        expect(decodeInbound(encodeInbound(inbound({ chain: null })))).toEqual(inbound({ chain: null }))
    })

    it("reads nothing from text that is absent, is not JSON, or is not an event", async () => {
        const { decodeInbound } = await buildSubject()

        expect(decodeInbound(undefined)).toBeUndefined()
        expect(decodeInbound("{not json")).toBeUndefined()
        expect(decodeInbound('{"eventType":"x"}')).toBeUndefined()
        expect(decodeInbound('{"eventType":"x","extra":1}')).toBeUndefined()
    })

    it("refuses an event with too many fields in its payload", async () => {
        const { encodeInbound, decodeInbound } = await buildSubject()
        const payload = Object.fromEntries(Array.from({ length: 101 }, (_, at) => ["k" + String(at), at]))

        expect(decodeInbound(encodeInbound(inbound({ payload })))).toBeUndefined()
    })
})
