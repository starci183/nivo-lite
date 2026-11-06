import { ORDER_STATUSES, cancelVerdictOf, canConfirm, canShip, isAwaitingPayment, isOrderStatus } from "./order-status"

describe("the statuses of an order", () => {
    it("tells a status from any other text", () => {
        expect(ORDER_STATUSES.every(isOrderStatus)).toBe(true)
        expect(isOrderStatus("shipped")).toBe(false)
    })

    it("waits for money while confirmed or invoiced", () => {
        expect(ORDER_STATUSES.filter(isAwaitingPayment)).toEqual(["confirmed", "invoiced"])
    })

    it("ships a confirmed, invoiced or paid order once", () => {
        expect(ORDER_STATUSES.filter((status) => canShip(status, null))).toEqual(["confirmed", "invoiced", "paid"])
        expect(canShip("paid", "2026-11-05T09:00:00Z")).toBe(false)
    })

    it("confirms only a draft", () => {
        expect(ORDER_STATUSES.filter(canConfirm)).toEqual(["draft"])
    })

    describe("cancelling an order", () => {
        const none = { allocations: 0, invoices: 0 }

        it("cancels a draft, and a confirmed order that no payment and no invoice touches", () => {
            expect(cancelVerdictOf({ status: "draft", ...none })).toEqual({ ok: true })
            expect(cancelVerdictOf({ status: "confirmed", ...none })).toEqual({ ok: true })
        })

        it("refuses a confirmed order with a payment allocated or an invoice issued, naming which", () => {
            expect(cancelVerdictOf({ status: "confirmed", allocations: 1, invoices: 0 })).toEqual({
                ok: false,
                reason: "order_has_payment",
            })
            expect(cancelVerdictOf({ status: "confirmed", allocations: 0, invoices: 2 })).toEqual({
                ok: false,
                reason: "order_has_invoice",
            })
        })

        it("refuses a paid order and an invoiced one whatever the facts say", () => {
            expect(cancelVerdictOf({ status: "paid", ...none })).toEqual({ ok: false, reason: "order_paid" })
            expect(cancelVerdictOf({ status: "invoiced", ...none })).toEqual({ ok: false, reason: "order_invoiced" })
        })

        it("refuses every other status as not cancellable", () => {
            const others = ORDER_STATUSES.filter((s) => !["draft", "confirmed", "paid", "invoiced"].includes(s))
            expect(others.length).toBeGreaterThan(0)
            others.forEach((status) =>
                expect(cancelVerdictOf({ status, ...none })).toEqual({ ok: false, reason: "order_not_cancellable" }),
            )
        })
    })
})
