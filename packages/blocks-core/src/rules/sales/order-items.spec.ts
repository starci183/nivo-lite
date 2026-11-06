import { itemLinesOf, itemsTextOf, pricedLinesOf } from "./order-items"

describe("the items text of an order", () => {
    it("writes one part per line", () => {
        expect(
            itemsTextOf([
                { name: "tea", qty: 2 },
                { name: "cake", qty: 1 },
            ]),
        ).toBe("2 x tea, 1 x cake")
    })

    it("reads the lines back, a part without a quantity counting once", () => {
        expect(itemLinesOf("2 x tea, cake,  , 1.5 x rice")).toEqual([
            { name: "tea", qty: 2 },
            { name: "cake", qty: 1 },
            { name: "rice", qty: 1.5 },
        ])
    })

    it("reads nothing from an empty text", () => {
        expect(itemLinesOf("")).toEqual([])
    })
})

describe("pricedLinesOf", () => {
    it("adds the price of one and what each line comes to, with a line named without a price kept at no price", () => {
        expect(
            pricedLinesOf([
                { name: "tea", qty: 2, unitVnd: 15_000 },
                { name: "cake", qty: 1.5 },
            ]),
        ).toEqual([
            { name: "tea", qty: 2, unitVnd: 15_000, amountVnd: 30_000 },
            { name: "cake", qty: 1.5, unitVnd: 0, amountVnd: 0 },
        ])
    })

    it("rounds a line to a whole dong", () => {
        expect(pricedLinesOf([{ name: "rice", qty: 1.5, unitVnd: 333 }])[0]?.amountVnd).toBe(500)
    })
})
