import { exactOf, onlyExactOf, paysExactly } from "./payment-match"

const CREDIT = { id: "tx-1", amountVnd: 1_188_000, reference: "gh-8k2q chuyen tien gia han" }

describe("the exact match of a credit and a request awaiting money", () => {
    it("names the code however the bank wrote it and compares the amount as whole VND", () => {
        expect(exactOf(CREDIT, { paymentCode: "GH8K2Q", totalVnd: 1_188_000 })).toEqual({ named: true, amountMatches: true })
        expect(exactOf(CREDIT, { paymentCode: "GH8K2Q", totalVnd: 1_177_000 })).toEqual({ named: true, amountMatches: false })
        expect(exactOf(CREDIT, { paymentCode: "ZZ9", totalVnd: 1_188_000 })).toEqual({ named: false, amountMatches: true })
    })

    it("never matches on an absent code, an absent total or an absent transfer text", () => {
        expect(exactOf(CREDIT, { paymentCode: null, totalVnd: null })).toEqual({ named: false, amountMatches: false })
        expect(exactOf(CREDIT, { paymentCode: "---", totalVnd: 1 })).toEqual({ named: false, amountMatches: false })
        expect(exactOf({ ...CREDIT, reference: null }, { paymentCode: "GH8K2Q", totalVnd: 1_188_000 }).named).toBe(false)
    })

    it("pays exactly only when the code is named and the total is equal", () => {
        expect(paysExactly({ named: true, amountMatches: true })).toBe(true)
        expect(paysExactly({ named: true, amountMatches: false })).toBe(false)
        expect(paysExactly({ named: false, amountMatches: true })).toBe(false)
    })

    it("settles on exactly one request and leaves none or several open", () => {
        const fit = { id: "a", exact: { named: true, amountMatches: true } }
        const short = { id: "b", exact: { named: true, amountMatches: false } }
        expect(onlyExactOf([short, fit])).toBe(fit)
        expect(onlyExactOf([short])).toBeNull()
        expect(onlyExactOf([fit, { ...fit, id: "c" }])).toBeNull()
        expect(onlyExactOf([])).toBeNull()
    })
})
