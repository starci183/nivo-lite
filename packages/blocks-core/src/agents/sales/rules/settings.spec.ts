import {
    DEFAULT_THRESHOLD_VND,
    MAX_THRESHOLD_VND,
    SALES_SETTINGS_DEFAULTS,
    needsOwner,
    salesSettingsShape,
} from "./settings"

describe("the sales settings", () => {
    it("start at the demo defaults", () => {
        expect(SALES_SETTINGS_DEFAULTS).toEqual({
            approvalThresholdVnd: 5_000_000,
            draftWithoutTotalNeedsApproval: true,
            closedDealsCanFlip: true,
            reopenNeedsApproval: true,
            maxDiscountPct: 10,
            remindAfterDays: 3,
            autoWon: true,
            notifyAccounting: true,
        })
        expect(DEFAULT_THRESHOLD_VND).toBe(5_000_000)
    })

    it("accept their own defaults and refuse a threshold out of range", () => {
        expect(salesSettingsShape.safeParse(SALES_SETTINGS_DEFAULTS).success).toBe(true)
        expect(salesSettingsShape.safeParse({ ...SALES_SETTINGS_DEFAULTS, approvalThresholdVnd: -1 }).success).toBe(
            false,
        )
        expect(
            salesSettingsShape.safeParse({ ...SALES_SETTINGS_DEFAULTS, approvalThresholdVnd: MAX_THRESHOLD_VND + 1 })
                .success,
        ).toBe(false)
    })
})

describe("needsOwner", () => {
    it("waits at the threshold and above, not below", () => {
        const settings = { approvalThresholdVnd: 5_000_000 }
        expect(needsOwner(4_999_999, settings)).toBe(false)
        expect(needsOwner(5_000_000, settings)).toBe(true)
        expect(needsOwner(6_000_000, settings)).toBe(true)
    })

    it("follows the threshold the workspace sets", () => {
        expect(needsOwner(1_000_000, { approvalThresholdVnd: 1_000_000 })).toBe(true)
        expect(needsOwner(1_000_000, { approvalThresholdVnd: 2_000_000 })).toBe(false)
    })
})
