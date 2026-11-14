import {
    creditsAtLeast,
    creditsFigureShown,
    creditsFromSql,
    creditsLeftShown,
    creditsUsedShown,
    sumCredits,
    usdExact,
} from "./credits.policy"
import { CREDIT_USD_VALUE, creditsOf } from "./usage-cost.policy"

describe("creditsOf: a call books cost / credit value exactly, never rounded up", () => {
    it("shows a call's credits as a fraction: one credit's worth is exactly 1, a tenth of it 0.1", () => {
        expect(creditsOf(CREDIT_USD_VALUE)).toBe(1)
        expect(creditsOf(CREDIT_USD_VALUE / 10)).toBe(0.1)
        expect(creditsOf(0.0123)).toBe(10.884956)
    })

    it("debits the exact sum: three calls of 0.4 credit are 1.2, not 3", () => {
        const call = creditsOf(CREDIT_USD_VALUE * 0.4)
        expect(call).toBe(0.4)
        expect(sumCredits([call, call, call])).toBe(1.2)
    })

    it("debits ten calls of a tenth of a credit as 1 credit, where rounding each call up would bill 10", () => {
        const call = CREDIT_USD_VALUE / 10
        expect(sumCredits(Array.from({ length: 10 }, () => creditsOf(call)))).toBe(1)
    })

    it("answers zero for no cost and for anything that is not a cost", () => {
        expect(creditsOf(0)).toBe(0)
        expect(creditsOf(-1)).toBe(0)
        expect(creditsOf(Number.NaN)).toBe(0)
        expect(usdExact(Number.POSITIVE_INFINITY)).toBe(0)
        expect(usdExact(0.123456789)).toBe(0.12345679)
    })
})

describe("exact credits keep 6 decimals", () => {
    it("sums without binary-float drift: 0.1 + 0.2 is 0.3", () => {
        expect(0.1 + 0.2).not.toBe(0.3)
        expect(sumCredits([0.1, 0.2])).toBe(0.3)
    })

    it("reads a numeric column (text) at 6 decimals and drops digits below a millionth", () => {
        expect(creditsFromSql("1.200000")).toBe(1.2)
        expect(creditsFromSql("99.9999996")).toBe(100)
        expect(creditsFromSql(null)).toBe(0)
    })

    it("compares at 6 decimals", () => {
        expect(creditsAtLeast(0.1 + 0.2, 0.3)).toBe(true)
        expect(creditsAtLeast(99.9999996, 100)).toBe(true)
        expect(creditsAtLeast(99.999999, 100)).toBe(false)
    })
})

describe("credits shown to people are whole numbers", () => {
    it("rounds used half up", () => {
        expect(creditsUsedShown(1.5)).toBe(2)
        expect(creditsUsedShown(1.49)).toBe(1)
        expect(creditsUsedShown(0.5)).toBe(1)
        expect(creditsUsedShown(2.499999)).toBe(2)
    })

    it("floors what is left, never showing more than is left", () => {
        expect(creditsLeftShown(0.99)).toBe(0)
        expect(creditsLeftShown(5.000001)).toBe(5)
        expect(creditsLeftShown(4.9999996)).toBe(5)
        expect(creditsLeftShown(-3)).toBe(0)
    })

    it("shows a figure under half a credit as <1 and exactly zero as 0", () => {
        expect(creditsFigureShown(0.4)).toBe("<1")
        expect(creditsFigureShown(0.000001)).toBe("<1")
        expect(creditsFigureShown(0.5)).toBe("1")
        expect(creditsFigureShown(1.49)).toBe("1")
        expect(creditsFigureShown(1.5)).toBe("2")
        expect(creditsFigureShown(0)).toBe("0")
    })
})
