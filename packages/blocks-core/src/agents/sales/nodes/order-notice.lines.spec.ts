import { summaryLinesOf } from "./order-notice.lines"

const items = {
    lines: [
        { name: "Tra Sen", qty: 2, unitVnd: 120_000, amountVnd: 240_000 },
        { name: "Banh", qty: 1, unitVnd: 0, amountVnd: 0 },
    ],
}

describe("summaryLinesOf", () => {
    it("puts each item's photo, quantity, unit price and line amount into the payload", () => {
        const lines = summaryLinesOf(items, [{ name: "Tra sen", imageUrl: "https://files.example/tra.jpg" }], "en")
        expect(lines[0]).toEqual({
            name: "Tra Sen",
            qty: 2,
            unitText: "120.000 VND",
            amountText: "240.000 VND",
            imageUrl: "https://files.example/tra.jpg",
        })
    })

    it("matches the catalogue name without accents or case", () => {
        const lines = summaryLinesOf(
            { lines: [{ name: `Tr${String.fromCodePoint(0xe0)} Sen`, qty: 1, unitVnd: 1000, amountVnd: 1000 }] },
            [{ name: "tra sen", imageUrl: "https://files.example/a.jpg" }],
            "vi",
        )
        expect(lines[0]?.imageUrl).toBe("https://files.example/a.jpg")
    })

    it("leaves out the photo of an item the catalogue lacks or lists without one, and the price of an unpriced line", () => {
        const lines = summaryLinesOf(items, [{ name: "Banh", imageUrl: null }], "en")
        expect(lines[0]).toEqual({ name: "Tra Sen", qty: 2, unitText: "120.000 VND", amountText: "240.000 VND" })
        expect(lines[1]).toEqual({ name: "Banh", qty: 1 })
    })

    it("has no lines for a record whose items cannot be read", () => {
        expect(summaryLinesOf("damaged", [], "en")).toEqual([])
        expect(summaryLinesOf(null, [], "vi")).toEqual([])
    })
})
