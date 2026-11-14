import { itemsTextOf, orderLinesOf, transferContentOf } from "./order-lines.policy"

describe("payment request policy", () => {
    it("keeps letters and digits of the order number, upper case", () => {
        expect(transferContentOf("DH-20261105-0001")).toBe("DH202611050001")
        expect(transferContentOf("so 2026/11_x")).toBe("SO202611X")
    })

    it("lists the items in a few words", () => {
        expect(
            itemsTextOf([
                { name: "tea", qty: 2 },
                { name: "cake", qty: 1 },
            ]),
        ).toBe("2 x tea, 1 x cake")
    })

    it("reads the lines from the object a sales record keeps them in, and finds none in any other shape instead of failing", () => {
        const record = { lines: [{ name: "tea", qty: 2, unitVnd: 150_000, amountVnd: 300_000 }] }

        expect(orderLinesOf(record)).toEqual([{ name: "tea", qty: 2 }])
        expect(orderLinesOf({ lines: [] })).toEqual([])
        for (const other of [[{ name: "tea", qty: 2 }], "2 x tea", null, undefined, {}, { lines: "tea" }]) {
            expect(orderLinesOf(other)).toEqual([])
        }
    })
})
