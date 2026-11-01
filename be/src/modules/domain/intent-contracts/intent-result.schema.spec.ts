import { agentRequestSchema, intentEnvelopeSchema, ownTurnPickSchema } from "./intent-result.schema"

const schemas = { agentRequestSchema, ownTurnPickSchema }
const envelope = intentEnvelopeSchema

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
