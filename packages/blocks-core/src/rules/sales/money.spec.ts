import { moneyLine } from "./money"

describe("moneyLine", () => {
    it("groups the thousands the Vietnamese way, with the dong sign", () => {
        expect(moneyLine(5_000_000)).toBe("5.000.000 ₫")
        expect(moneyLine(360_000)).toBe("360.000 ₫")
        expect(moneyLine(999)).toBe("999 ₫")
        expect(moneyLine(0)).toBe("0 ₫")
    })

    it("rounds to a whole dong", () => {
        expect(moneyLine(1234.6)).toBe("1.235 ₫")
    })

    it("says nothing while the amount is unknown", () => {
        expect(moneyLine(null)).toBe("")
    })
})
