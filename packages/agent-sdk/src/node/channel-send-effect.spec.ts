import { channelSendCodePayload, channelSendEffect, lineOrderSchema } from "./channel-send-effect"

const CARD = {
    orderNo: "DH-1",
    lines: [{ name: "Basket", qty: 1, unitText: "2.000" }],
    amountText: "2.000",
    address: "",
    paid: false,
}
/** What package CODE may send (a node's own call): with the finished card of an order. */
const parse = (payload: unknown) => channelSendCodePayload.safeParse(payload).success

describe("channelSendEffect payload", () => {
    it("takes a message to a person (the run's own by default), on a channel and an account when named, with the finished card of what it is about", () => {
        expect(parse({ text: "Hello" })).toBe(true)
        expect(parse({ contactId: "k1", channel: "zalo", accountId: "conn-1", text: "Hello", order: CARD })).toBe(true)
        expect(parse({ text: "Hello", images: [{ url: "https://img/1.png", caption: "QR" }] })).toBe(true)
    })

    it("names no conversation: an id of one is not part of the payload any more", () => {
        const parsed = channelSendCodePayload.safeParse({ conversationId: "c1", text: "Hello" })
        expect(parsed.success).toBe(true)
        expect(parsed.data).toEqual({ text: "Hello" })
    })

    it("no longer takes an id to build a card from: the step builds the card", () => {
        expect(lineOrderSchema.safeParse({ ...CARD, orderNo: 5 }).success).toBe(false)
        expect(parse({ text: "Hello", order: { orderNo: "DH-1" } })).toBe(false)
    })

    it("never lets a MODEL type the card of an order: its call carries no order, whatever it typed beside its words", () => {
        const typed = { contactId: "k1", text: "Hello", order: { ...CARD, amountText: "0", paid: true } }
        const parsed = channelSendEffect.payload.safeParse(typed)
        expect(parsed.success).toBe(true)
        expect(parsed.data).toEqual({ contactId: "k1", text: "Hello" })
        expect(channelSendEffect.codePayload).toBe(channelSendCodePayload)
        expect(channelSendCodePayload.safeParse(typed).data).toEqual(typed)
    })

    it("refuses empty words and more than ten pictures", () => {
        const pictures = Array.from({ length: 11 }, (_, index) => ({
            url: `https://img/${String(index)}.png`,
            caption: "",
        }))
        expect(parse({ text: "" })).toBe(false)
        expect(parse({ text: "Hello", images: pictures })).toBe(false)
    })
})
