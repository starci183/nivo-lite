import { Test } from "@nestjs/testing"
import { chipsOf, hasOrder, isAwaitingPayment, stageOf } from "./inbox-lead-stage.policy"
import type { StageFacts } from "./inbox-lead-stage.policy"

const POLICY = Symbol("./inbox-lead-stage.policy")
type PolicySubject = {
    chipsOf: typeof chipsOf
    hasOrder: typeof hasOrder
    isAwaitingPayment: typeof isAwaitingPayment
    stageOf: typeof stageOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { chipsOf, hasOrder, isAwaitingPayment, stageOf } }],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(POLICY)
    return { subject }
}

const facts = (over: Partial<StageFacts>): StageFacts => ({
    leadStage: "new",
    orders: [],
    hasMatchedPayment: false,
    ...over,
})

describe("inbox lead stage", () => {
    it("is new for a lead the sales module has not moved and that has no order", async () => {
        const { subject } = await buildSubject()
        const { stageOf } = subject
        expect(stageOf(facts({}))).toBe("new")
    })

    it("is consulting once the sales module qualified the lead", async () => {
        const { subject } = await buildSubject()
        const { stageOf } = subject
        expect(stageOf(facts({ leadStage: "qualified" }))).toBe("consulting")
        expect(stageOf(facts({ leadStage: "proposal" }))).toBe("consulting")
    })

    it("is not ordered while the only order is a draft or cancelled", async () => {
        const { subject } = await buildSubject()
        const { hasOrder, stageOf } = subject
        const orders = [
            { status: "draft", isShipped: false },
            { status: "cancelled", isShipped: false },
        ]
        expect(hasOrder(facts({ orders }))).toBe(false)
        expect(stageOf(facts({ orders }))).toBe("new")
    })

    it("is ordered once an order is confirmed and awaits its payment", async () => {
        const { subject } = await buildSubject()
        const { isAwaitingPayment, stageOf } = subject
        const orders = [{ status: "confirmed", isShipped: false }]
        expect(stageOf(facts({ orders }))).toBe("ordered")
        expect(isAwaitingPayment(orders)).toBe(true)
    })

    it("is paid when an order is paid or a credit matched", async () => {
        const { subject } = await buildSubject()
        const { stageOf } = subject
        expect(stageOf(facts({ orders: [{ status: "paid", isShipped: false }] }))).toBe("paid")
        expect(stageOf(facts({ hasMatchedPayment: true }))).toBe("paid")
    })

    it("is done when the paid order shipped or the sales module closed the lead", async () => {
        const { subject } = await buildSubject()
        const { stageOf } = subject
        expect(stageOf(facts({ orders: [{ status: "paid", isShipped: true }] }))).toBe("done")
        expect(stageOf(facts({ leadStage: "lost" }))).toBe("done")
        expect(stageOf(facts({ leadStage: "won", hasMatchedPayment: true }))).toBe("done")
    })

    it("puts what needs the owner first among the chips", async () => {
        const { subject } = await buildSubject()
        const { chipsOf } = subject
        expect(chipsOf({ stage: "new", needsOwner: true, awaitingPayment: false, isUnmatched: false })).toEqual([
            "needs_you",
            "new",
        ])
        expect(chipsOf({ stage: "ordered", needsOwner: false, awaitingPayment: true, isUnmatched: false })).toEqual([
            "awaiting_payment",
        ])
        expect(chipsOf({ stage: "paid", needsOwner: false, awaitingPayment: false, isUnmatched: true })).toEqual([
            "unmatched",
        ])
    })
})
