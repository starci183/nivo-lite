import { customerReplySchema } from "./customer-intents.schema"

describe("customerReplySchema", () => {
    it("fills every member of the reply contract of today", () => {
        const parsed = customerReplySchema.safeParse({ reply: " Hello " })

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
        const parsed = customerReplySchema.safeParse({
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
            application: { phone: "", availability: "" },
            knowledge_gap: { topic: "Hours" },
        })
    })

    it("refuses a member it does not know, a long reply and a wrong shape", () => {
        const accepts = (value: unknown) => customerReplySchema.safeParse(value).success

        expect(accepts({ reply: "ok", extra: 1 })).toBe(false)
        expect(accepts({ reply: "a".repeat(4001) })).toBe(false)
        expect(accepts({ reply: "ok", order: { items: "x", amount_vnd: 1.5 } })).toBe(false)
        expect(accepts({ reply: "ok", reason: "other" })).toBe(false)
        expect(accepts({})).toBe(false)
    })
})
