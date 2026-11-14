import {
    ACCOUNTING_SETTINGS_DEFAULTS,
    REMATCH_DAYS_MAX,
    REMATCH_DAYS_MIN,
    VAT_PERIODS,
    VOID_MODES,
    accountingSettingsShape,
} from "./settings"

describe("the accounting settings", () => {
    it("start at the demo defaults", () => {
        expect(ACCOUNTING_SETTINGS_DEFAULTS).toEqual({
            postExpenses: true,
            postOutgoing: true,
            postUnmatched: false,
            voidMode: "reversal",
            vatPeriod: "quarterly",
            rematchDays: 7,
        })
        expect(VOID_MODES).toEqual(["reversal", "none"])
        expect(VAT_PERIODS).toEqual(["monthly", "quarterly"])
    })

    it("bound the days a payment code looks back", () => {
        const days = (rematchDays: number): boolean =>
            accountingSettingsShape.safeParse({ ...ACCOUNTING_SETTINGS_DEFAULTS, rematchDays }).success
        expect([days(REMATCH_DAYS_MIN), days(7), days(REMATCH_DAYS_MAX)]).toEqual([true, true, true])
        expect([days(0), days(REMATCH_DAYS_MAX + 1), days(2.5)]).toEqual([false, false, false])
    })

    it("accept their own defaults and refuse a void mode they do not know", () => {
        expect(accountingSettingsShape.safeParse(ACCOUNTING_SETTINGS_DEFAULTS).success).toBe(true)
        expect(accountingSettingsShape.safeParse({ ...ACCOUNTING_SETTINGS_DEFAULTS, voidMode: "delete" }).success).toBe(
            false,
        )
        expect(
            accountingSettingsShape.safeParse({ ...ACCOUNTING_SETTINGS_DEFAULTS, vatPeriod: "yearly" }).success,
        ).toBe(false)
    })
})
