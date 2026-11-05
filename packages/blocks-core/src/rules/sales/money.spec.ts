import { moneyLine } from "./money"

describe("moneyLine", () => {
    it("groups the thousands", () => {
        expect(moneyLine(5_000_000)).toBe("5,000,000 VND")
        expect(moneyLine(360_000)).toBe("360,000 VND")
        expect(moneyLine(999)).toBe("999 VND")
        expect(moneyLine(0)).toBe("0 VND")
    })

    it("rounds to a whole dong", () => {
        expect(moneyLine(1234.6)).toBe("1,235 VND")
    })

    it("says nothing while the amount is unknown", () => {
        expect(moneyLine(null)).toBe("")
    })
})
