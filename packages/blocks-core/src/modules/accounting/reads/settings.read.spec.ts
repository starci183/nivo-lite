import type { ReadRunResult } from "@nivo-lite/agent-sdk/block"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { ACCOUNTING_SETTINGS_DEFAULTS } from "../../../rules/accounting/settings"
import type { AccountingSettings } from "../../../rules/accounting/settings"
import { providerOf, settingsStore } from "../accounting.doubles"
import { accountingSettingsPort } from "../ports"
import { settingsRead } from "./settings.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T11:30:00.000Z") }

const dataOf = async (saved: AccountingSettings | null): Promise<unknown> => {
    const provider = providerOf([[accountingSettingsPort, settingsStore({ get: () => Promise.resolve(saved) })]])
    const result: ReadRunResult = (await settingsRead.execute?.(provider, {}, CONTEXT)) ?? { ok: false, problems: [] }
    return result.ok ? result.data : result.problems
}

describe("accounting.settings", () => {
    it("gives the defaults before the first save", async () => {
        expect(await dataOf(null)).toEqual(ACCOUNTING_SETTINGS_DEFAULTS)
    })

    it("gives what the workspace saved", async () => {
        const saved = { ...ACCOUNTING_SETTINGS_DEFAULTS, postUnmatched: true }
        expect(await dataOf(saved)).toEqual(saved)
    })
})
