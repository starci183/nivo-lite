import { classificationOf, vndOf } from "./classify.policy"
import { intentClassifyNode } from "./classify.node"
import { expectedEffects, runExample } from "../node-examples.fixture"

describe("intent.classify", () => {
    it.each(intentClassifyNode.examples.map((example) => [example.name, example] as const))(
        "example: %s",
        async (_name, example) => {
            const run = await runExample(intentClassifyNode, example)
            expect(run.output).toEqual(example.output)
            expect(run.effects).toEqual(expectedEffects(example))
        },
    )

    it("hands the model the messages one per line, blanks dropped, and records no effect", async () => {
        const [example] = intentClassifyNode.examples
        const asks: Array<unknown> = []
        const run = await intentClassifyNode.run(
            { text: "một\n\n  \nhai" },
            {
                turn: { turnId: "t", workspaceId: "w", agentId: "a", subject: null },
                params: {},
                data: { read: () => Promise.resolve([]), write: () => Promise.reject(new Error("no write")) },
                effect: () => Promise.reject(new Error("no effect")),
                model: {
                    text: () => Promise.reject(new Error("no text")),
                    json: (schema, ask) => {
                        asks.push(ask)
                        return Promise.resolve(
                            schema.parse({ intents: ["question"], order: null, payment_claim: null }),
                        )
                    },
                },
                now: () => new Date(0),
            },
        )
        expect(run).toEqual({ intents: ["question"], order: null, paymentClaim: null })
        expect(asks).toEqual([
            expect.objectContaining({ purpose: "intent-classify", input: { messages: ["một", "hai"] } }),
        ])
        expect(example?.effects).toEqual([])
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
