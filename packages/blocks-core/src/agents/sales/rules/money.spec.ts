import { moneyLine } from "./money"

describe("moneyLine", () => {
    it("groups the thousands the Vietnamese way, with the dong sign", () => {
        expect(moneyLine(5_000_000)).toBe("5.000.000\u00a0\u20ab")
        expect(moneyLine(360_000)).toBe("360.000\u00a0\u20ab")
        expect(moneyLine(999)).toBe("999\u00a0\u20ab")
        expect(moneyLine(0)).toBe("0\u00a0\u20ab")
    })

    it("rounds to a whole dong", () => {
        expect(moneyLine(1234.6)).toBe("1.235\u00a0\u20ab")
    })

    it("says nothing while the amount is unknown", () => {
        expect(moneyLine(null)).toBe("")
    })
})
