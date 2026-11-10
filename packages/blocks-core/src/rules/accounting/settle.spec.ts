import { CLAIM, ORDER, TRANSACTION, claimOf, orderOf, transactionOf } from "./accounting.fixtures"
import { confirmationText, settleDecision } from "./settle"

const clean = { transaction: TRANSACTION, order: ORDER, claim: null }

describe("settle decision", () => {
    it("pays a confirmed or invoiced order with the exact amount, from a transfer or from an open claim", () => {
        expect(settleDecision(clean, null)).toEqual({
            kind: "pay",
            facts: { expectedVnd: 5_000_000, receivedVnd: 5_000_000, differenceVnd: 0 },
            transaction: TRANSACTION,
            order: ORDER,
            claim: null,
        })
        expect(settleDecision({ ...clean, claim: CLAIM }, CLAIM.id)).toEqual({
            kind: "pay",
            facts: { expectedVnd: 5_000_000, receivedVnd: 5_000_000, differenceVnd: 0 },
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
            facts: {},
        })
        expect(settleDecision({ ...clean, order: null }, null)).toEqual({
            kind: "refuse",
            reason: "order_missing",
            facts: {},
        })
        expect(settleDecision(clean, CLAIM.id)).toEqual({ kind: "refuse", reason: "claim_missing", facts: {} })
    })

    it("refuses money out, a transaction that paid another order and an order that no longer waits, with the true values", () => {
        const amounts = { receivedVnd: 5_000_000, orderAmountVnd: 5_000_000 }
        expect(settleDecision({ ...clean, transaction: transactionOf({ direction: "debit" }) }, null)).toEqual({
            kind: "refuse",
            reason: "transaction_not_credit",
            facts: amounts,
        })
        expect(settleDecision({ ...clean, transaction: transactionOf({ orderId: "other" }) }, null)).toEqual({
            kind: "refuse",
            reason: "transaction_used",
            facts: { ...amounts, paidOrderId: "other" },
        })
        expect(settleDecision({ ...clean, order: orderOf({ status: "paid" }) }, null)).toEqual({
            kind: "refuse",
            reason: "order_not_open",
            facts: { ...amounts, status: "paid" },
        })
    })

    it("never refuses the amount: a short or an over credit pays the order, with the two amounts and the gap", () => {
        expect(settleDecision({ ...clean, order: orderOf({ amountVnd: 4_000_000 }) }, null)).toMatchObject({
            kind: "pay",
            facts: { expectedVnd: 4_000_000, receivedVnd: 5_000_000, differenceVnd: 1_000_000 },
        })
        expect(settleDecision({ ...clean, order: orderOf({ amountVnd: 5_000_001 }) }, null)).toMatchObject({
            kind: "pay",
            facts: { expectedVnd: 5_000_001, receivedVnd: 5_000_000, differenceVnd: -1 },
        })
        expect(settleDecision({ ...clean, order: orderOf({ amountVnd: null }) }, null)).toEqual({
            kind: "refuse",
            reason: "order_unpriced",
            facts: { receivedVnd: 5_000_000 },
        })
    })

    it("refuses a claim closed another way", () => {
        for (const status of ["settled", "withdrawn"] as const) {
            const closed = claimOf({ status, settledTransactionId: "other" })
            expect(settleDecision({ ...clean, claim: closed }, CLAIM.id)).toMatchObject({
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
