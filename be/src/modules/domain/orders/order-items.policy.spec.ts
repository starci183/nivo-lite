import { itemLinesOf, itemsTextOf } from "./order-items.policy"

describe("order items policy", () => {
    it("writes the lines as quantity times name", () => {
        const lines = [
            { name: "tea", qty: 2, unitPriceVnd: 5, catalogueItemId: "c1" },
            { name: "cake", qty: 1 },
        ]

        expect(itemsTextOf(lines)).toBe("2 x tea, 1 x cake")
    })

    it("reads the lines back and counts a part without a quantity once", () => {
        expect(itemLinesOf("2 x tea, 1.5 x rice, plain cake, ")).toEqual([
            { name: "tea", qty: 2 },
            { name: "rice", qty: 1.5 },
            { name: "plain cake", qty: 1 },
        ])
        expect(itemLinesOf("")).toEqual([])
    })
})
