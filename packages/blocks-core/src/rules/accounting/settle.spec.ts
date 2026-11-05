import { CLAIM, ORDER, TRANSACTION, claimOf, orderOf, transactionOf } from "./accounting.fixtures"
import { confirmationText, settleDecision } from "./settle"

const clean = { transaction: TRANSACTION, order: ORDER, claim: null }

describe("settle decision", () => {
    it("pays a confirmed or invoiced order with the exact amount, from a transfer or from an open claim", () => {
        expect(settleDecision(clean, null)).toEqual({
            kind: "pay",
            transaction: TRANSACTION,
            order: ORDER,
            claim: null,
        })
        expect(settleDecision({ ...clean, claim: CLAIM }, CLAIM.id)).toEqual({
            kind: "pay",
            transaction: TRANSACTION,
            order: ORDER,
            claim: CLAIM,
        })
        expect(settleDecision({ ...clean, order: orderOf({ status: "invoiced" }) }, null).kind).toBe("pay")
    })

    it("answers an escalated claim, and the claim this very transaction already settled", () => {
        expect(settleDecision({ ...clean, claim: claimOf({ status: "escalated" }) }, CLAIM.id).kind).toBe("pay")
        const settled = claimOf({ status: "settled", settledTransactionId: TRANSACTION.id })
        expect(settleDecision({ ...clean, claim: settled }, CLAIM.id).kind).toBe("pay")
    })

    it("finds an order the transaction already paid unchanged", () => {
        const paid = transactionOf({ orderId: ORDER.id, status: "matched" })
        expect(settleDecision({ ...clean, transaction: paid }, null)).toEqual({ kind: "already" })
    })

    it("refuses what it cannot find", () => {
        expect(settleDecision({ ...clean, transaction: null }, null)).toEqual({
            kind: "refuse",
            reason: "transaction_missing",
        })
        expect(settleDecision({ ...clean, order: null }, null)).toEqual({ kind: "refuse", reason: "order_missing" })
        expect(settleDecision(clean, CLAIM.id)).toEqual({ kind: "refuse", reason: "claim_missing" })
    })

    it("refuses money out, a transaction that paid another order and an order that no longer waits", () => {
        expect(settleDecision({ ...clean, transaction: transactionOf({ direction: "debit" }) }, null)).toEqual({
            kind: "refuse",
            reason: "transaction_not_credit",
        })
        expect(settleDecision({ ...clean, transaction: transactionOf({ orderId: "other" }) }, null)).toEqual({
            kind: "refuse",
            reason: "transaction_used",
        })
        expect(settleDecision({ ...clean, order: orderOf({ status: "paid" }) }, null)).toEqual({
            kind: "refuse",
            reason: "order_not_open",
        })
    })

    it("refuses another amount, an unpriced order and a claim closed another way", () => {
        expect(settleDecision({ ...clean, order: orderOf({ amountVnd: 4_000_000 }) }, null)).toEqual({
            kind: "refuse",
            reason: "amount_differs",
        })
        expect(settleDecision({ ...clean, order: orderOf({ amountVnd: null }) }, null).kind).toBe("refuse")
        for (const status of ["settled", "withdrawn"] as const) {
            const closed = claimOf({ status, settledTransactionId: "other" })
            expect(settleDecision({ ...clean, claim: closed }, CLAIM.id)).toEqual({
                kind: "refuse",
                reason: "claim_closed",
            })
        }
    })

    it("fills the confirmation the customer is told", () => {
        expect(confirmationText("Shop da nhan {amount} cho {orderNo}", "DH-1", 5_000_000)).toBe(
            "Shop da nhan 5.000.000 cho DH-1",
        )
    })
})
