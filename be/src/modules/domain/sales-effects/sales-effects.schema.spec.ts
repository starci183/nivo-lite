import {
    confirmSchema,
    conversationSchema,
    ensureSchema,
    recordIdSchema,
    recordSchema,
    voidSchema,
} from "./sales-effects.schema"

describe("sales-effects.schema", () => {
    it("reads the id of a record as a uuid and nothing else", () => {
        expect(recordIdSchema.safeParse("11111111-1111-4111-8111-111111111111").success).toBe(true)
        expect(recordIdSchema.safeParse("lead-1").success).toBe(false)
    })

    it("reads what an order effect carries and drops what it does not name", () => {
        expect(confirmSchema.parse({ orderId: "o-1", extra: 1 })).toEqual({ orderId: "o-1" })
        expect(voidSchema.parse({ id: "o-1" })).toEqual({ id: "o-1" })
        const record = { leadId: "l-1", items: [{ name: "tea", qty: 1 }], address: "25 Nguyen Hue" }
        expect(recordSchema.safeParse(record).success).toBe(true)
        expect(recordSchema.parse({ ...record, amountVnd: 10, items: [{ name: "tea", qty: 1, unitVnd: 5 }] })).toEqual(record)
    })

    it("bounds what an effect carries: an empty id, no item lines, a quantity that is not positive", () => {
        const record = { leadId: "l-1", items: [{ name: "tea", qty: 1 }] }
        expect(confirmSchema.safeParse({ orderId: "" }).success).toBe(false)
        expect(voidSchema.safeParse({ id: "" }).success).toBe(false)
        expect(recordSchema.safeParse({ ...record, items: [] }).success).toBe(false)
        expect(recordSchema.safeParse({ ...record, items: [{ name: "tea", qty: 0 }] }).success).toBe(false)
    })

    it("reads what a nivo.lead.ensure asks for: a conversation, and a name and a phone when the chat knows them", () => {
        expect(ensureSchema.safeParse({ conversationId: "c-1", phone: "0912", name: "Lan" }).success).toBe(true)
        expect(ensureSchema.safeParse({ name: "Lan" }).success).toBe(false)
    })

    it("reads the fields of a conversation a customer is made from", () => {
        expect(conversationSchema.safeParse({ name: "Guest 7", channel: "zalo" }).success).toBe(true)
        expect(conversationSchema.safeParse({ name: "Guest 7" }).success).toBe(false)
    })
})
