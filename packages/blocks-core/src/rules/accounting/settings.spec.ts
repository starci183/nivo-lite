import { ACCOUNTING_SETTINGS_DEFAULTS, VAT_PERIODS, VOID_MODES, accountingSettingsShape } from "./settings"

describe("the accounting settings", () => {
    it("start at the demo defaults", () => {
        expect(ACCOUNTING_SETTINGS_DEFAULTS).toEqual({
            postExpenses: true,
            postOutgoing: true,
            postUnmatched: false,
            voidMode: "reversal",
            vatPeriod: "quarterly",
        })
        expect(VOID_MODES).toEqual(["reversal", "none"])
        expect(VAT_PERIODS).toEqual(["monthly", "quarterly"])
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
