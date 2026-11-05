import { paymentOrderOutcome, transferStatus } from "./transfer"
import type { PaymentOrderTerms } from "./transfer"

const NOW = new Date("2026-11-04T12:00:00.000Z")
const pending: PaymentOrderTerms = { status: "pending", amountVnd: 500_000, expiresAt: "2026-11-05T00:00:00.000Z" }

describe("transfer", () => {
    it("ignores money out and keeps the outcome of money in, listing an ignored credit as unmatched", () => {
        expect(transferStatus(false, "paid")).toBe("ignored")
        expect(transferStatus(true, "paid")).toBe("paid")
        expect(transferStatus(true, "underpaid")).toBe("underpaid")
        expect(transferStatus(true, "ignored")).toBe("unmatched")
    })

    it("pays a pending order with the full amount, or more", () => {
        expect(paymentOrderOutcome(pending, 500_000, NOW)).toBe("paid")
        expect(paymentOrderOutcome(pending, 600_000, NOW)).toBe("paid")
    })

    it("calls an amount below the due one underpaid", () => {
        expect(paymentOrderOutcome(pending, 499_999, NOW)).toBe("underpaid")
    })

    it("ignores an order already paid and expires one that is not pending or ran out", () => {
        expect(paymentOrderOutcome({ ...pending, status: "paid" }, 500_000, NOW)).toBe("ignored")
        expect(paymentOrderOutcome({ ...pending, status: "cancelled" }, 500_000, NOW)).toBe("expired")
        expect(paymentOrderOutcome({ ...pending, expiresAt: "2026-11-04T11:59:59.000Z" }, 500_000, NOW)).toBe("expired")
    })
})
