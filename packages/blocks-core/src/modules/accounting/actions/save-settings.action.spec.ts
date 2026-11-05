import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { ACCOUNTING_SETTINGS_DEFAULTS } from "../../../rules/accounting/settings"
import type { AccountingSettings } from "../../../rules/accounting/settings"
import { providerOf, settingsStore } from "../accounting.doubles"
import { accountingSettingsPort } from "../ports"
import { saveSettingsAction } from "./save-settings.action"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T12:00:00.000Z") }

const NOT_RUNNABLE: ActionResult = { ok: false, reason: "failed", message: { key: "not_runnable" } }

const harness = (saved: AccountingSettings | null) => {
    const writes: Array<AccountingSettings> = []
    const provider = providerOf([
        [
            accountingSettingsPort,
            settingsStore({
                get: () => Promise.resolve(saved),
                save: (settings) => {
                    writes.push(settings)
                    return Promise.resolve(settings)
                },
            }),
        ],
    ])
    const run = (raw: unknown): Promise<ActionResult> =>
        saveSettingsAction.execute?.(provider, raw, CONTEXT) ?? Promise.resolve(NOT_RUNNABLE)
    return { writes, run }
}

describe("accounting.save-settings", () => {
    it("saves the values given on top of the defaults before the first save", async () => {
        const { writes, run } = harness(null)
        expect(await run({ postUnmatched: true, voidMode: "none" })).toEqual({ ok: true })
        expect(writes).toEqual([{ ...ACCOUNTING_SETTINGS_DEFAULTS, postUnmatched: true, voidMode: "none" }])
    })

    it("keeps the saved value of what is left empty", async () => {
        const saved = { ...ACCOUNTING_SETTINGS_DEFAULTS, postExpenses: false, voidMode: "none" } as const
        const { writes, run } = harness(saved)
        await run({ id: "", postExpenses: null, postOutgoing: false, postUnmatched: null, voidMode: null })
        expect(writes).toEqual([{ ...saved, postOutgoing: false }])
    })

    it("refuses a void mode it does not know", async () => {
        const { writes, run } = harness(null)
        expect(await run({ voidMode: "delete" })).toMatchObject({ ok: false, reason: "invalid" })
        expect(writes).toEqual([])
    })

    it("declares who may save it and what it refreshes", () => {
        expect(saveSettingsAction).toMatchObject({ permission: "accounting.manage", transactional: true })
        expect(saveSettingsAction.refreshes).toContain("accounting.settings")
    })
})
