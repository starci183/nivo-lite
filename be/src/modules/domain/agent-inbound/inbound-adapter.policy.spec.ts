import { Test } from "@nestjs/testing"
import { actorTrustOf, wakeTraitsOf } from "./inbound-adapter.policy"
import type { InboundActor, InboundAdapter } from "./agent-inbound.contracts"

const SUBJECT = Symbol("inbound-adapter.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { actorTrustOf, wakeTraitsOf } }],
    }).compile()
    return moduleRef.get<typeof import("./inbound-adapter.policy")>(SUBJECT)
}

const adapter = (over: Partial<InboundAdapter> = {}): InboundAdapter => ({
    key: "invoice_hook",
    authentication: "signature",
    trustOf: () => "outsider",
    awaitsAnswer: false,
    replyStep: null,
    doorStep: "door",
    priority: 25,
    maxAttempts: 3,
    ...over,
})

const actor = (over: Partial<InboundActor> = {}): InboundActor => ({
    kind: "member",
    id: "m-1",
    role: "staff",
    ...over,
})

describe("wakeTraitsOf", () => {
    it("reads priority and attempts from the adapter and the rest from how it proves events and whether the sender waits", async () => {
        const { wakeTraitsOf } = await buildSubject()

        expect(wakeTraitsOf(adapter())).toEqual({
            priority: 25,
            maxAttempts: 3,
            scopedToConversation: false,
            background: false,
            restoresHeld: true,
            awaitsAnswer: false,
        })
    })

    it("treats an internal adapter as background work that a switch does not bring back", async () => {
        const { wakeTraitsOf } = await buildSubject()

        expect(wakeTraitsOf(adapter({ authentication: "internal" }))).toMatchObject({
            background: true,
            restoresHeld: false,
        })
    })

    it("locks by conversation and gives the holding line at once for an adapter whose sender waits", async () => {
        const { wakeTraitsOf } = await buildSubject()

        expect(wakeTraitsOf(adapter({ awaitsAnswer: true }))).toMatchObject({
            scopedToConversation: true,
            awaitsAnswer: true,
        })
    })
})

describe("actorTrustOf", () => {
    it("trusts the system as the system, an owner or manager as a manager, and anyone else as a member", async () => {
        const { actorTrustOf } = await buildSubject()

        expect(actorTrustOf(actor({ kind: "system", role: null }))).toBe("system")
        expect(actorTrustOf(actor({ role: "owner" }))).toBe("manager")
        expect(actorTrustOf(actor({ role: "manager" }))).toBe("manager")
        expect(actorTrustOf(actor({ role: "staff" }))).toBe("member")
        expect(actorTrustOf(actor({ kind: "agent", role: null }))).toBe("member")
    })
})
