import { nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { coreEffects } from "../../vocabulary/effects"
import { intentClassifyNode } from "./classify.node"
import { classificationOf, messagesOf, vndOf } from "./classify.policy"

describe("intent.classify", () => {
    it.each(intentClassifyNode.examples.map((each) => [each.name, each] as const))(
        "example: %s",
        async (_name, each) => {
            await expect(nodeExampleMismatches(intentClassifyNode, each, coreEffects)).resolves.toEqual([])
        },
    )
})

describe("messagesOf", () => {
    it("is one message per non-blank line", () => {
        expect(messagesOf("một\n\n  \nhai")).toEqual(["một", "hai"])
    })
})

describe("vndOf", () => {
    it.each([
        [5000, 5000],
        [0, null],
        [Number.NaN, null],
        ["5k", 5000],
        ["1,5tr", 1_500_000],
        ["2 triệu", 2_000_000],
        ["500 nghìn", 500_000],
        ["5.000đ", 5000],
        ["120000 VND", 120_000],
        ["năm nghìn", null],
        ["", null],
        [null, null],
    ])("reads %p as %p", (written, amount) => {
        expect(vndOf(written)).toBe(amount)
    })
})

describe("classificationOf", () => {
    it("cleans the slots: blank items dropped, quantity bounded, blank strings null", () => {
        const output = classificationOf({
            intents: ["order", "other", "order"],
            order: {
                items: [
                    { name: " hoa ", quantity: 0 },
                    { name: "  ", quantity: 3 },
                    { name: "chậu", quantity: null },
                    { name: "đèn", quantity: 99_999 },
                ],
                address: "   ",
                customer: " Lan ",
            },
            payment_claim: { amount_vnd: "abc", payer_name: "" },
        })
        expect(output).toEqual({
            intents: ["order", "payment_claim"],
            order: {
                items: [
                    { name: "hoa", quantity: 1, priceVnd: null },
                    { name: "chậu", quantity: 1, priceVnd: null },
                    { name: "đèn", quantity: 10_000, priceVnd: null },
                ],
                address: null,
                customer: "Lan",
            },
            paymentClaim: { amountVnd: null, payerName: null },
        })
    })

    it("keeps an order intent whose slot is absent, and drops other beside a real intent", () => {
        expect(classificationOf({ intents: ["other", "order"], order: null, payment_claim: null })).toEqual({
            intents: ["order"],
            order: null,
            paymentClaim: null,
        })
    })
})
