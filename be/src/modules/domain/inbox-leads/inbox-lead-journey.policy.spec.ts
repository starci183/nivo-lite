import { Test } from "@nestjs/testing"
import { approvalOf, needsOf, ordersOf, paidOf, sourceOf, timelineOf, viaOf } from "./inbox-lead-journey.policy"
import type { LeadFacts, OrderFacts } from "./inbox-lead-row.policy"
import type { JourneyEvent } from "./inbox-leads-events.service"

const POLICY = Symbol("./inbox-lead-journey.policy")
type PolicySubject = {
    approvalOf: typeof approvalOf
    needsOf: typeof needsOf
    ordersOf: typeof ordersOf
    paidOf: typeof paidOf
    sourceOf: typeof sourceOf
    timelineOf: typeof timelineOf
    viaOf: typeof viaOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: POLICY, useValue: { approvalOf, needsOf, ordersOf, paidOf, sourceOf, timelineOf, viaOf } },
        ],
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
    note: "card",
    createdAt: "2026-11-09T07:00:00.000Z",
    updatedAt: "2026-11-09T08:00:00.000Z",
    ...over,
})

const facts = (over: Partial<LeadFacts>): LeadFacts => ({
    id: "l1",
    name: "An",
    channel: "website",
    via: "form",
    leadStage: "new",
    need: "need",
    contextSummary: null,
    quoteVnd: 1000,
    nextStep: "7:00",
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

const event = (over: Partial<JourneyEvent>): JourneyEvent => ({
    id: "e1",
    kind: "lead",
    channel: "website",
    body: "form",
    amount_vnd: null,
    source: {},
    sender_name: "An",
    sender_contact: null,
    created_at: "2026-11-09T07:00:00.000Z",
    ...over,
})

describe("inbox lead journey", () => {
    it("asks for the draft order, or only for a decision when no order waits", async () => {
        const { subject } = await buildSubject()
        const { approvalOf } = subject
        expect(approvalOf(facts({ orders: [order({})] }), "Sales")).toEqual({
            orderId: "o1",
            orderNo: "DH-1",
            amountVnd: 4000,
            itemsText: "roses",
            agentName: "Sales",
        })
        expect(approvalOf(facts({ orders: [order({ orderNo: "" })] }), null)?.orderNo).toBeNull()
        expect(approvalOf(facts({ waitingWork: 1 }), null)?.orderId).toBeNull()
        expect(approvalOf(facts({}), null)).toBeNull()
    })

    it("takes the needs from the newest live order before the lead", async () => {
        const { subject } = await buildSubject()
        const { needsOf } = subject
        expect(
            needsOf(facts({ orders: [order({ status: "confirmed", amountVnd: 2000 })] }), "lead note"),
        ).toMatchObject({
            items: "roses",
            valueVnd: 2000,
            delivery: "7:00",
            note: "card",
        })
        expect(needsOf(facts({}), "lead note")).toMatchObject({ items: "need", valueVnd: 1000, note: "lead note" })
    })

    it("tells the source from the first input that says one", async () => {
        const { subject } = await buildSubject()
        const { sourceOf } = subject
        const events = [
            event({ id: "late", source: {}, created_at: "2026-11-09T09:00:00.000Z" }),
            event({ id: "first", source: { page: "/p", campaign: "c", device: "mobile" } }),
        ]
        expect(sourceOf(facts({}), events)).toEqual({
            channel: "website",
            via: "form",
            landing: "/p",
            campaign: "c",
            device: "mobile",
        })
        expect(sourceOf(facts({}), []).landing).toBeNull()
    })
})

describe("inbox lead journey parts", () => {
    it("reads a posted form as a form and a typed line as a chat, on a website only", async () => {
        const { subject } = await buildSubject()
        const { viaOf } = subject
        expect(viaOf("website", "lead")).toBe("form")
        expect(viaOf("website", "message")).toBe("chat")
        expect(viaOf("zalo", "message")).toBeNull()
    })

    it("lists the orders that are more than a draft and sums what was paid", async () => {
        const { subject } = await buildSubject()
        const { ordersOf, paidOf } = subject
        const orders = [
            order({}),
            order({ id: "o2", status: "paid", amountVnd: 5000 }),
            order({ id: "o3", status: "paid", amountVnd: 1000 }),
        ]
        expect(ordersOf(orders).map((one) => one.id)).toEqual(["o2", "o3"])
        expect(paidOf(orders)).toEqual({ amountVnd: 6000, count: 2 })
        expect(paidOf([order({ status: "paid", amountVnd: null })])).toEqual({ amountVnd: 0, count: 1 })
    })

    it("puts the journey oldest first and shows a paid order once when a receipt exists", async () => {
        const { subject } = await buildSubject()
        const { timelineOf } = subject
        const orders = [order({ id: "o2", status: "paid", orderNo: "DH-2", updatedAt: "2026-11-09T10:00:00.000Z" })]
        const withReceipt = timelineOf({
            events: [
                event({}),
                event({ id: "pay", kind: "payment", channel: "bank", created_at: "2026-11-09T09:00:00.000Z" }),
            ],
            work: [{ id: "w1", action: "confirm_order", status: "done", at: "2026-11-09T07:30:00.000Z" }],
            decisions: [],
            orders,
        })
        expect(withReceipt.map((entry) => entry.id)).toEqual(["ev:e1", "wk:w1", "ev:pay"])
        const withoutReceipt = timelineOf({ events: [event({})], work: [], decisions: [], orders })
        expect(withoutReceipt.map((entry) => entry.kind)).toEqual(["message", "payment"])

        const rich = timelineOf({
            events: [event({ id: "ord", kind: "order", created_at: "2026-11-09T07:10:00.000Z" })],
            work: [],
            decisions: [{ id: "d1", outcome: "approved", action: "confirm_order", at: "2026-11-09T07:20:00.000Z" }],
            orders: [order({ id: "o9", status: "confirmed", orderNo: "DH-9" })],
        })
        expect(rich.map((entry) => [entry.id, entry.kind, entry.status])).toEqual([
            ["od:o9", "order", "confirmed"],
            ["ev:ord", "order", null],
            ["dc:d1", "decision", "approved"],
        ])
    })
})
