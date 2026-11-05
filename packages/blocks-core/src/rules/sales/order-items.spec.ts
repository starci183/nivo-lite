import { itemLinesOf, itemsTextOf } from "./order-items"

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
