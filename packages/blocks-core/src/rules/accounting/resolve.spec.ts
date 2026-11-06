import { TRANSACTION, transactionOf } from "./accounting.fixtures"
import { OTHER_INCOME_KIND, RESOLVE_COMMAND, otherIncomeDecision } from "./resolve"

describe("otherIncomeDecision", () => {
    it("names the command and the kind the approval row sends", () => {
        expect(RESOLVE_COMMAND).toBe("accounting.resolve-unmatched-payment")
        expect(OTHER_INCOME_KIND).toBe("other-income")
    })

    it("records money in that still waits, unmatched or waiting for review", () => {
        expect(otherIncomeDecision(TRANSACTION)).toEqual({ kind: "record", transaction: TRANSACTION })
        const review = transactionOf({ status: "needs_review" })
        expect(otherIncomeDecision(review)).toEqual({ kind: "record", transaction: review })
    })

    it("refuses a payment that is gone, money out, or already resolved", () => {
        expect(otherIncomeDecision(null)).toEqual({ kind: "refuse", reason: "transaction_missing" })
        expect(otherIncomeDecision(transactionOf({ direction: "debit" }))).toEqual({
            kind: "refuse",
            reason: "transaction_not_credit",
        })
        for (const status of ["matched", "other_income"] as const)
            expect(otherIncomeDecision(transactionOf({ status }))).toEqual({
                kind: "refuse",
                reason: "transaction_not_open",
            })
    })
})
