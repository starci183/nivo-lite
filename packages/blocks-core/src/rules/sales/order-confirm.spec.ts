import { confirmDecision, waitsForOwner } from "./order-confirm"
import type { ConfirmInput } from "./order-confirm"
import type { OrderStatus } from "./order-status"

const THRESHOLD = 5_000_000

describe("waitsForOwner", () => {
    it("waits at the threshold and above, not below", () => {
        expect(waitsForOwner({ status: "draft", amountVnd: 4_999_999 }, THRESHOLD)).toBe(false)
        expect(waitsForOwner({ status: "draft", amountVnd: THRESHOLD }, THRESHOLD)).toBe(true)
        expect(waitsForOwner({ status: "draft", amountVnd: 9_000_000 }, THRESHOLD)).toBe(true)
    })

    it("waits while the total is unknown", () => {
        expect(waitsForOwner({ status: "draft", amountVnd: null }, THRESHOLD)).toBe(true)
    })

    it("waits for nothing once the order is no draft", () => {
        expect(waitsForOwner({ status: "confirmed", amountVnd: 9_000_000 }, THRESHOLD)).toBe(false)
    })
})

describe("confirmDecision", () => {
    it("confirms a small draft by anyone", () => {
        expect(
            confirmDecision({ status: "draft", amountVnd: 360_000, thresholdVnd: THRESHOLD, byOwner: false }),
        ).toEqual({
            kind: "confirm",
        })
    })

    it("makes a big draft wait unless the owner confirms it", () => {
        const big: Omit<ConfirmInput, "byOwner"> = {
            status: "draft",
            amountVnd: THRESHOLD,
            thresholdVnd: THRESHOLD,
        }
        expect(confirmDecision({ ...big, byOwner: false })).toEqual({ kind: "wait_owner" })
        expect(confirmDecision({ ...big, byOwner: true })).toEqual({ kind: "confirm" })
    })

    it("makes an unpriced draft wait for the owner", () => {
        expect(confirmDecision({ status: "draft", amountVnd: null, thresholdVnd: THRESHOLD, byOwner: false })).toEqual({
            kind: "wait_owner",
        })
    })

    it("changes nothing for an order already confirmed", () => {
        const settled: ReadonlyArray<OrderStatus> = ["confirmed", "invoiced", "paid"]
        for (const status of settled)
            expect(confirmDecision({ status, amountVnd: 1, thresholdVnd: THRESHOLD, byOwner: false })).toEqual({
                kind: "already",
            })
    })

    it("refuses an order that was cancelled or cut short", () => {
        const dead: ReadonlyArray<OrderStatus> = ["cancelled", "failed_system"]
        for (const status of dead)
            expect(confirmDecision({ status, amountVnd: 1, thresholdVnd: THRESHOLD, byOwner: true })).toEqual({
                kind: "refused",
                reason: "not_confirmable",
            })
    })
})
