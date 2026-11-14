import { agentMessageCodePayload, agentMessagePostEffect } from "@nivo-lite/agent-sdk/team-chat"
import { orderSummaryKind, paymentReceivedKind } from "../modules/sales/agent-message-kinds"
import { cardOrderOf, matchedCreditsOf, teamCardPostOf, teamOrderCardOf, teamPaymentCardOf } from "./team-cards"

/** The order row the engine's team-post executor read before the cards moved here (its spec's `ORDER`). */
const ORDER_ROW = {
    orderNo: "DH-1",
    amountVnd: 2000,
    items: { lines: [{ name: "Small basket", qty: 1, unitVnd: 2000, amountVnd: 2000 }] },
    note: "25 Nguyen Hue",
    leadId: "l1",
}

describe("the order card a sales step posts to the team", () => {
    const order = cardOrderOf(ORDER_ROW)
    if (order === null) throw new Error("the fixture order has a number")

    it("is the card the engine used to build from the same order and customer, field for field", () => {
        expect(teamCardPostOf(teamOrderCardOf(order, "An", [], "en"))).toEqual({
            kind: "order.summary",
            intent: "notify",
            title: "New order DH-1",
            summary: "New order DH-1 \u00b7 1 x Small basket \u00b7 2.000 VND \u00b7 customer An \u00b7 deliver to 25 Nguyen Hue",
            payload: {
                orderNo: "DH-1",
                lines: [{ name: "Small basket", qty: 1, unitText: "2.000 VND", amountText: "2.000 VND" }],
                amountText: "2.000 VND",
                customer: "An",
                address: "25 Nguyen Hue",
            },
            work: { label: "order", href: "/agents/sales/workbench" },
        })
    })

    it("is accepted by the engine's schema of the post and by the schema of its registered kind", () => {
        const post = teamCardPostOf(teamOrderCardOf(order, "An", [], "en"), "own")
        expect(agentMessageCodePayload.safeParse(post).success).toBe(true)
        expect(agentMessagePostEffect.payload.safeParse(post).success).toBe(false)
        expect(orderSummaryKind.payload.safeParse(post.payload).success).toBe(true)
        expect(post.audience).toBe("own")
    })

    it("no longer lets a caller name an order id to have the engine build the card", () => {
        expect(agentMessageCodePayload.safeParse({ kind: "order.summary", orderId: "o1" }).success).toBe(false)
        expect(agentMessagePostEffect.payload.safeParse({ kind: "payment.received", orderId: "o1" }).success).toBe(
            false,
        )
    })

    it("reads a row with no order number as no order", () => {
        expect(cardOrderOf({ amountVnd: 1 })).toBeNull()
        expect(cardOrderOf(undefined)).toBeNull()
    })

    it("takes the address of an order recorded before it had the field from its note", () => {
        expect(cardOrderOf({ orderNo: "DH-2", note: "old address" })).toMatchObject({
            amountVnd: null,
            note: "old address",
        })
        expect(cardOrderOf({ orderNo: "DH-2", note: "n", deliveryAddress: "a" })).toMatchObject({ note: "a" })
    })
})

describe("the payment card a sales step posts to the team", () => {
    const order = cardOrderOf(ORDER_ROW)
    if (order === null) throw new Error("the fixture order has a number")
    const credit = (amountVnd: number, status = "matched", direction = "credit") => ({ amountVnd, direction, status })

    it("is the card the engine used to build for one credit, field for field", () => {
        const post = teamCardPostOf(teamPaymentCardOf(order, matchedCreditsOf([credit(1500)]), "An", [], "en"))
        expect(post).toMatchObject({
            kind: "payment.received",
            intent: "notify",
            title: "1.500 VND",
            summary: "Received 1.500 VND for DH-1",
            payload: { orderNo: "DH-1", amountText: "1.500 VND", customer: "An" },
        })
        expect(post.payload).not.toHaveProperty("credits")
        expect(agentMessageCodePayload.safeParse(post).success).toBe(true)
        expect(agentMessagePostEffect.payload.safeParse(post).success).toBe(false)
        expect(paymentReceivedKind.payload.safeParse(post.payload).success).toBe(true)
    })

    it("shows the total of the matched credits and each one oldest first; a debit or an unmatched row is not money received", () => {
        // Listed newest first (`order (orderId, id desc)`): the 1.000 arrived after the 1.500.
        const rows = [credit(1000), credit(700, "needs_review"), credit(300, "matched", "debit"), credit(1500)]
        expect(matchedCreditsOf(rows)).toEqual([1500, 1000])
        expect(teamCardPostOf(teamPaymentCardOf(order, matchedCreditsOf(rows), "An", [], "en"))).toMatchObject({
            title: "2.500 VND",
            summary: "Received 2.500 VND for DH-1",
            payload: { amountText: "2.500 VND", credits: ["1.500 VND", "1.000 VND"] },
        })
    })

    it("has no credits for an order nothing paid", () => {
        expect(matchedCreditsOf([])).toEqual([])
    })
})
