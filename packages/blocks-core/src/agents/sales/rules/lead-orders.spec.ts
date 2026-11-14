import { orderSummaryOf } from "./lead-orders"
import type { OrderBrief } from "./lead-orders"

const order = (
    orderNo: string,
    status: OrderBrief["status"],
    amountVnd: number | null,
    createdAt: string,
): OrderBrief => ({
    orderNo,
    status,
    amountVnd,
    createdAt,
})

describe("orderSummaryOf", () => {
    it("holds nothing for a customer with no order", () => {
        expect(orderSummaryOf([])).toEqual({ count: 0, confirmedVnd: 0, latest: null })
    })

    it("counts the live orders, adds the confirmed ones and names the newest", () => {
        const newest = order("DH-3", "draft", null, "2026-11-05T09:00:00Z")
        const summary = orderSummaryOf([
            order("DH-1", "paid", 1_000_000, "2026-11-01T09:00:00Z"),
            newest,
            order("DH-2", "confirmed", 500_000, "2026-11-03T09:00:00Z"),
            order("DH-0", "invoiced", null, "2026-10-01T09:00:00Z"),
        ])
        expect(summary).toEqual({ count: 4, confirmedVnd: 1_500_000, latest: newest })
    })

    it("leaves cancelled and failed orders out", () => {
        const summary = orderSummaryOf([
            order("DH-1", "cancelled", 9_000_000, "2026-11-04T09:00:00Z"),
            order("DH-2", "failed_system", 9_000_000, "2026-11-05T09:00:00Z"),
        ])
        expect(summary).toEqual({ count: 0, confirmedVnd: 0, latest: null })
    })
})
