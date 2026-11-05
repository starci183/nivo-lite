import { ORDER_STATUSES, canCancel, canShip, isAwaitingPayment, isOrderStatus } from "./order-status"

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

    it("cancels only a draft", () => {
        expect(ORDER_STATUSES.filter(canCancel)).toEqual(["draft"])
    })
})
