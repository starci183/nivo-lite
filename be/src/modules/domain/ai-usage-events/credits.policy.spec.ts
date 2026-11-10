import { creditsExact, usdExact } from "./credits.policy"
import { CREDIT_USD_VALUE, creditsOf } from "./usage-cost.policy"

describe("creditsExact (display) vs creditsOf (the bill)", () => {
    it("shows a call's credits as a fraction: one credit's worth is exactly 1, a tenth of it 0.1", () => {
        expect(creditsExact(CREDIT_USD_VALUE)).toBe(1)
        expect(creditsExact(CREDIT_USD_VALUE / 10)).toBe(0.1)
        expect(creditsExact(0.0123)).toBe(10.884956)
    })

    it("never rounds up per call: ten calls of a tenth of a credit show 1 credit, where rounding each call would bill 10", () => {
        const call = CREDIT_USD_VALUE / 10
        const shown = creditsExact(Array.from({ length: 10 }, () => call).reduce((sum, cost) => sum + cost, 0))
        const billedPerCall = Array.from({ length: 10 }, () => creditsOf(call)).reduce(
            (sum, credits) => sum + credits,
            0,
        )

        expect(shown).toBe(1)
        expect(billedPerCall).toBe(10)
        // The bill of a TOTAL still rounds up once (billing is unchanged by U1).
        expect(creditsOf(call * 10)).toBe(1)
        expect(creditsOf(call * 10.5)).toBe(2)
    })

    it("answers zero for no cost and for anything that is not a cost", () => {
        expect(creditsExact(0)).toBe(0)
        expect(creditsExact(-1)).toBe(0)
        expect(creditsExact(Number.NaN)).toBe(0)
        expect(usdExact(Number.POSITIVE_INFINITY)).toBe(0)
        expect(usdExact(0.123456789)).toBe(0.12345679)
    })
})
