import { ORDER, TRANSACTION, orderOf, transactionOf } from "./accounting.fixtures"
import { REPOST_COMMAND, canRepost, repostDecision } from "./ledger-repost"

const PAID = transactionOf({ status: "matched", orderId: ORDER.id })
const PAID_ORDER = orderOf({ status: "paid" })

describe("repostDecision", () => {
    it("names the command of the action", () => {
        expect(REPOST_COMMAND).toBe("sales.repost-ledger")
    })

    it("queues a payment that paid an order that is paid", () => {
        expect(repostDecision(PAID, PAID_ORDER)).toEqual({ kind: "queue", transaction: PAID, order: PAID_ORDER })
        expect(canRepost(PAID, PAID_ORDER)).toBe(true)
    })

    it("refuses a payment that is gone, or paid no order", () => {
        expect(repostDecision(null, PAID_ORDER)).toEqual({ kind: "refuse", reason: "transaction_missing" })
        expect(repostDecision(TRANSACTION, PAID_ORDER)).toEqual({ kind: "refuse", reason: "transaction_not_paid" })
        expect(repostDecision(transactionOf({ status: "matched", orderId: null }), PAID_ORDER)).toEqual({
            kind: "refuse",
            reason: "transaction_not_paid",
        })
        expect(canRepost(TRANSACTION, PAID_ORDER)).toBe(false)
    })

    it("refuses an order that is gone or not paid", () => {
        expect(repostDecision(PAID, null)).toEqual({ kind: "refuse", reason: "order_missing" })
        expect(repostDecision(PAID, orderOf({ status: "confirmed" }))).toEqual({
            kind: "refuse",
            reason: "order_not_paid",
        })
        expect(canRepost(PAID, null)).toBe(false)
    })
})
