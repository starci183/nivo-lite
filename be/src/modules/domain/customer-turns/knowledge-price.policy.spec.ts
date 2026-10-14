import { isKnownPrice, pricesInKnowledge } from "./knowledge-price.policy"

describe("pricesInKnowledge", () => {
    it("reads millions, thousands and plain amounts, once each", () => {
        expect(pricesInKnowledge("5 tri\u1ec7u, 1,5tr, 500k, 500 nghin, 5.000.000 \u0111, 12000")).toEqual([
            5_000_000, 1_500_000, 500_000, 12_000,
        ])
    })

    it("ignores an empty knowledge, small counts, and a unit glued to a letter", () => {
        expect(pricesInKnowledge(null)).toEqual([])
        expect(pricesInKnowledge("3 cups and 999 notes")).toEqual([])
        expect(pricesInKnowledge("5 tra and 500kg")).toEqual([])
    })

    it("drops a zero amount and keeps a grouped thousand", () => {
        expect(pricesInKnowledge("0 trieu and 1.200.000")).toEqual([1_200_000])
        expect(pricesInKnowledge("500 ng\u00e0n and 1,000")).toEqual([500_000, 1_000])
    })

    it("rejects overflowing amounts and grouped numbers below one thousand", () => {
        const overflow = "9".repeat(400)
        expect(pricesInKnowledge(`${overflow} trieu; ${overflow}k; 0.001; 0,999`)).toEqual([])
    })

    it("structurally preserves an empty result when a scaled match has no amount capture", () => {
        // Real patterns require this capture; inject a malformed intermediate to pin the defensive fallback.
        const captures: [string] = ["5 trieu"]
        const malformed: RegExpExecArray = Object.assign(captures, { index: 0, input: "5 trieu" })
        const matchAll = jest.spyOn(String.prototype, "matchAll").mockImplementation(() => [malformed].values())
        try {
            expect(pricesInKnowledge("5 trieu")).toEqual([])
        } finally {
            matchAll.mockRestore()
        }
    })
})

describe("isKnownPrice", () => {
    it("accepts the rounded amount the owner wrote", () => {
        expect(isKnownPrice("5 trieu", 5_000_000.4)).toBe(true)
    })

    it.each([
        ["a missing knowledge", null, 5_000_000],
        ["an invented price", "5 trieu", 4_000_000],
        ["zero", "5 trieu", 0],
        ["a negative amount", "5 trieu", -1],
        ["a non-finite amount", "5 trieu", Number.NaN],
    ])("rejects %s", (_label, knowledge, amount) => {
        expect(isKnownPrice(knowledge, amount)).toBe(false)
    })
})
