import { agentMessageCodePayload, agentMessagePostEffect } from "./agent-message-post-effect"

/** What package CODE may post (a node's own call): the words, an answer and a finished card. */
const parse = (payload: unknown) => agentMessageCodePayload.safeParse(payload).success
/** What a MODEL's call may carry (the shape it is shown and checked against). */
const parseModel = (payload: unknown) => agentMessagePostEffect.payload.safeParse(payload).success

const CARD = {
    kind: "pkg.card",
    intent: "notify",
    title: "Card 7",
    summary: "Card 7 \u00b7 12",
    payload: { no: "7", total: 12 },
    work: { label: "card", href: "/cards/7" },
}

describe("agentMessagePostEffect payload", () => {
    it("takes plain words, an answer to a person and a finished card of a kind a package registered", () => {
        expect(parse({ kind: "message.text", intent: "ask", title: "Hi", text: "Call them" })).toBe(true)
        expect(parse({ kind: "chat.answer", messageId: "m1", text: "Done" })).toBe(true)
        expect(parse(CARD)).toBe(true)
        expect(parse({ ...CARD, audience: "own" })).toBe(true)
    })

    it("never takes a card that names a record to build from: the package builds it", () => {
        expect(parse({ kind: "order.summary", orderId: "o1" })).toBe(false)
    })

    it("does not let a card take the kind of a member that has its own shape", () => {
        expect(parse({ ...CARD, kind: "message.text" })).toBe(false)
        expect(parse({ ...CARD, kind: "chat.answer" })).toBe(false)
    })

    it("lets a MODEL post only words or an answer: a finished card is refused, so no amount on a card is ever typed by a model", () => {
        expect(agentMessagePostEffect.codePayload).toBe(agentMessageCodePayload)
        expect(parseModel({ kind: "message.text", intent: "ask", title: "Hi", text: "Call them" })).toBe(true)
        expect(parseModel({ kind: "chat.answer", messageId: "m1", text: "Done" })).toBe(true)
        expect(parseModel(CARD)).toBe(false)
        expect(parseModel({ ...CARD, audience: "own" })).toBe(false)
        expect(
            parseModel({
                kind: "order.summary",
                intent: "notify",
                title: "DH-1",
                summary: "DH-1",
                payload: { amountText: "0 \u20ab" },
            }),
        ).toBe(false)
        expect(parseModel({ kind: "order.summary", orderId: "o1" })).toBe(false)
    })

    it("refuses a card with no content, no heading or an unknown audience", () => {
        expect(parse({ ...CARD, payload: undefined })).toBe(false)
        expect(parse({ ...CARD, title: "" })).toBe(false)
        expect(parse({ ...CARD, audience: "nobody" })).toBe(false)
    })
})
