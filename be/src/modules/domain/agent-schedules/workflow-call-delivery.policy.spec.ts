import { Test } from "@nestjs/testing"
import type { DeliverResult } from "@modules/domain/provider-triggers"
import { callDeliveryOf } from "./workflow-call-delivery.policy"

const SUBJECT = Symbol("workflow-call-delivery.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { callDeliveryOf } }],
    }).compile()
    return moduleRef.get<{ callDeliveryOf: typeof callDeliveryOf }>(SUBJECT)
}

const delivered = (over: Partial<Extract<DeliverResult, { status: "delivered" }>>): DeliverResult => ({
    status: "delivered",
    events: 1,
    dropped: 0,
    woken: [],
    repeats: 0,
    untaken: 0,
    held: 0,
    ...over,
})

describe("callDeliveryOf", () => {
    it("is started when a wake was written, whatever else the delivery counted", async () => {
        const policy = await buildSubject()
        const woken = [{ agentId: "a-1", workflowId: "w-1", eventId: "k", wakeId: "wake-1" }]

        expect(policy.callDeliveryOf(delivered({ woken }))).toBe("started")
        expect(policy.callDeliveryOf(delivered({ woken, repeats: 1 }))).toBe("started")
    })

    it("is duplicate when the same call was delivered before", async () => {
        const policy = await buildSubject()
        expect(policy.callDeliveryOf(delivered({ repeats: 1 }))).toBe("duplicate")
    })

    it("is refused when nothing was written: untaken, dropped, off or disconnected", async () => {
        const policy = await buildSubject()
        expect(policy.callDeliveryOf(delivered({ untaken: 1 }))).toBe("refused")
        expect(policy.callDeliveryOf(delivered({ events: 0, dropped: 1 }))).toBe("refused")
        expect(policy.callDeliveryOf({ status: "off" })).toBe("refused")
        expect(policy.callDeliveryOf({ status: "disconnected" })).toBe("refused")
    })
})
