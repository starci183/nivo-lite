import { orderOf, transactionOf } from "./accounting.fixtures"
import {
    CODE_ISSUED_AT,
    CREDIT_BEFORE_CODE,
    CREDIT_NO_CODE,
    CREDIT_OTHER_ORDER,
    CREDIT_PARTIAL,
    REMATCH_ORDER,
} from "./rematch.fixtures"
import { creditsNamingCode, sinceOf } from "./rematch"

describe("sinceOf", () => {
    it("counts the days back from the instant the code was issued", () => {
        expect(sinceOf(CODE_ISSUED_AT, 3)).toBe("2026-11-03T09:00:00.000Z")
        expect(sinceOf(CODE_ISSUED_AT, 0)).toBe(CODE_ISSUED_AT)
    })
})

describe("creditsNamingCode", () => {
    it("finds every unmatched credit that names the code, whatever its amount and the language of its content", () => {
        expect(creditsNamingCode(REMATCH_ORDER, [CREDIT_BEFORE_CODE, CREDIT_PARTIAL, CREDIT_NO_CODE, CREDIT_OTHER_ORDER])).toEqual([
            CREDIT_BEFORE_CODE,
            CREDIT_PARTIAL,
        ])
    })

    it("leaves out money out and a credit that is already matched", () => {
        const out = transactionOf({ ...CREDIT_BEFORE_CODE, id: "out", direction: "debit" })
        const matched = transactionOf({ ...CREDIT_BEFORE_CODE, id: "matched", status: "matched" })

        expect(creditsNamingCode(REMATCH_ORDER, [out, matched])).toEqual([])
    })

    it("finds none for an order that no longer waits for money", () => {
        expect(creditsNamingCode(orderOf({ ...REMATCH_ORDER, status: "paid" }), [CREDIT_BEFORE_CODE])).toEqual([])
    })
})
