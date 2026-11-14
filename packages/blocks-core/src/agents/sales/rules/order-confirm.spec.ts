import { confirmDecision, waitsForOwner } from "./order-confirm"
import type { ConfirmInput } from "./order-confirm"
import type { OrderStatus } from "./order-status"
import { SALES_SETTINGS_DEFAULTS } from "./settings"

const SETTINGS = SALES_SETTINGS_DEFAULTS
const THRESHOLD = SETTINGS.approvalThresholdVnd

describe("waitsForOwner", () => {
    it("waits at the threshold and above, not below", () => {
        expect(waitsForOwner({ status: "draft", amountVnd: 4_999_999 }, SETTINGS)).toBe(false)
        expect(waitsForOwner({ status: "draft", amountVnd: THRESHOLD }, SETTINGS)).toBe(true)
        expect(waitsForOwner({ status: "draft", amountVnd: 9_000_000 }, SETTINGS)).toBe(true)
    })

    it("follows the threshold the workspace sets", () => {
        const settings = { ...SETTINGS, approvalThresholdVnd: 1_000_000 }
        expect(waitsForOwner({ status: "draft", amountVnd: 1_000_000 }, settings)).toBe(true)
    })

    it("waits while the total is unknown, unless the workspace says it need not", () => {
        expect(waitsForOwner({ status: "draft", amountVnd: null }, SETTINGS)).toBe(true)
        expect(
            waitsForOwner({ status: "draft", amountVnd: null }, { ...SETTINGS, draftWithoutTotalNeedsApproval: false }),
        ).toBe(false)
    })

    it("waits for nothing once the order is no draft", () => {
        expect(waitsForOwner({ status: "confirmed", amountVnd: 9_000_000 }, SETTINGS)).toBe(false)
    })
})

describe("confirmDecision", () => {
    it("confirms a small draft by anyone", () => {
        expect(confirmDecision({ status: "draft", amountVnd: 360_000, settings: SETTINGS, byOwner: false })).toEqual({
            kind: "confirm",
        })
    })

    it("makes a big draft wait unless the owner confirms it", () => {
        const big: Omit<ConfirmInput, "byOwner"> = { status: "draft", amountVnd: THRESHOLD, settings: SETTINGS }
        expect(confirmDecision({ ...big, byOwner: false })).toEqual({ kind: "wait_owner" })
        expect(confirmDecision({ ...big, byOwner: true })).toEqual({ kind: "confirm" })
    })

    it("makes an unpriced draft wait for the owner", () => {
        expect(confirmDecision({ status: "draft", amountVnd: null, settings: SETTINGS, byOwner: false })).toEqual({
            kind: "wait_owner",
        })
    })

    it("lets anyone confirm an unpriced draft when the workspace says so", () => {
        const settings = { ...SETTINGS, draftWithoutTotalNeedsApproval: false }
        expect(confirmDecision({ status: "draft", amountVnd: null, settings, byOwner: false })).toEqual({
            kind: "confirm",
        })
    })

    it("changes nothing for an order already confirmed", () => {
        const settled: ReadonlyArray<OrderStatus> = ["confirmed", "invoiced", "paid"]
        for (const status of settled)
            expect(confirmDecision({ status, amountVnd: 1, settings: SETTINGS, byOwner: false })).toEqual({
                kind: "already",
            })
    })

    it("refuses an order that was cancelled or cut short", () => {
        const dead: ReadonlyArray<OrderStatus> = ["cancelled", "failed_system"]
        for (const status of dead)
            expect(confirmDecision({ status, amountVnd: 1, settings: SETTINGS, byOwner: true })).toEqual({
                kind: "refused",
                reason: "not_confirmable",
            })
    })
})
