import {
    agentRequestSchema,
    customerReplySchema,
    intentEnvelopeSchema,
    ownTurnPickSchema,
} from "./intent-result.schema"

const schemas = { customerReplySchema, agentRequestSchema, ownTurnPickSchema }
const envelope = intentEnvelopeSchema

describe("customer_reply", () => {
    it("fills every member of the reply contract of today", () => {
        const parsed = schemas.customerReplySchema.safeParse({ reply: " Hello " })

        expect(parsed.success && parsed.data).toEqual({
            reply: "Hello",
            lead: null,
            needs_human: false,
            reason: null,
            proposed_answer: null,
            order: null,
            payment_claim: false,
            knowledge_gap: null,
            booking_request: null,
            loyalty: null,
            application: null,
        })
    })

    it("reads the members of a full reply", () => {
        const parsed = schemas.customerReplySchema.safeParse({
            reply: "ok",
            lead: { contact_name: "An", need: "quote", phone: "0901" },
            needs_human: true,
            reason: "over_authority",
            proposed_answer: "Final",
            order: { items: "Combo", amount_vnd: 90_000 },
            payment_claim: true,
            knowledge_gap: { question: "Open on Sunday?", topic: "Hours" },
            booking_request: { intent: "book", service: "Cut", date: "2026-11-02", time: "09:00" },
            loyalty: { intent: "redeem", reward_key: "free-cut" },
            application: { job: "J1", name: "Binh", consent: true, answers: [{ question_id: "q1", answer: "yes" }] },
        })

        expect(parsed.success && parsed.data).toMatchObject({
            lead: { company: "", email: null },
            booking_request: { party_size: 1, note: null },
        })
        expect(parsed.success && parsed.data).toMatchObject({
            application: { phone: "", availability: "" },
            knowledge_gap: { topic: "Hours" },
        })
    })

    it("refuses a member it does not know, a long reply and a wrong shape", () => {
        const accepts = (value: unknown) => schemas.customerReplySchema.safeParse(value).success

        expect(accepts({ reply: "ok", extra: 1 })).toBe(false)
        expect(accepts({ reply: "a".repeat(4001) })).toBe(false)
        expect(accepts({ reply: "ok", order: { items: "x", amount_vnd: 1.5 } })).toBe(false)
        expect(accepts({ reply: "ok", reason: "other" })).toBe(false)
        expect(accepts({})).toBe(false)
    })
})

describe("agent_request", () => {
    it("fills the members of the internal contract for one action", () => {
        const parsed = schemas.agentRequestSchema.safeParse({ action: "send_quote", summary: " Quote " })

        expect(parsed.success && parsed.data).toEqual({
            action: "send_quote",
            leadId: null,
            fields: {},
            summary: "Quote",
            reply: "",
            tasks: [],
            needsHuman: false,
            reason: "",
        })
    })

    it("reads a subject, fields and tasks, and refuses too many", () => {
        const task = { op: "add", key: "k", title: "T", nextActionAt: "2026-11-03T08:00:00+07:00" }

        const parsed = schemas.agentRequestSchema.safeParse({
            action: "send_quote",
            subject: { type: "lead", id: "l1" },
            fields: { amount_vnd: 3, note: "x", none: null },
            tasks: [task],
        })

        expect(parsed.success).toBe(true)
        expect(
            schemas.agentRequestSchema.safeParse({ action: "a", tasks: Array.from({ length: 11 }, () => task) })
                .success,
        ).toBe(false)
        expect(
            schemas.agentRequestSchema.safeParse({
                action: "a",
                fields: Object.fromEntries(Array.from({ length: 31 }, (_, index) => [`f${index}`, 1])),
            }).success,
        ).toBe(false)
    })
})

describe("own_turn_pick and the envelope", () => {
    it("takes nothing but an empty result", () => {
        expect(schemas.ownTurnPickSchema.safeParse({}).success).toBe(true)
        expect(schemas.ownTurnPickSchema.safeParse({ reply: "x" }).success).toBe(false)
    })

    it("reads the intent, a result and a gap, and nothing else", () => {
        expect(envelope.safeParse({ intent: "none", result: {}, gap: { question: "Q", topic: "T" } }).success).toBe(
            true,
        )
        expect(envelope.safeParse({ intent: "reply_customer" }).success).toBe(true)
        expect(envelope.safeParse({ intent: "", result: {} }).success).toBe(false)
        expect(envelope.safeParse({ intent: "a", other: 1 }).success).toBe(false)
    })
})
