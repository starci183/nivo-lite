import { ACCOUNTING_SETTINGS_DEFAULTS } from "../../../rules/accounting/settings"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { providerOf, settingsStore } from "../accounting.doubles"
import { accountingSettingsPort } from "../ports"
import { dueSoonRead } from "./due-soon.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T11:30:00.000Z") }

describe("the accounting.due-soon read", () => {
    it("lists the declarations that fall due within 30 days of now, value added tax by quarter by default", async () => {
        const result = await dueSoonRead.execute?.(
            providerOf([[accountingSettingsPort, settingsStore({ get: () => Promise.resolve(null) })]]),
            {},
            CONTEXT,
        )
        expect(result).toMatchObject({
            ok: true,
            data: { rows: [{ kind: "pit", unit: "month", period: 10 }] },
        })
    })

    it("follows the filing period the workspace chose", async () => {
        const saved = { ...ACCOUNTING_SETTINGS_DEFAULTS, vatPeriod: "monthly" } as const
        const result = await dueSoonRead.execute?.(
            providerOf([[accountingSettingsPort, settingsStore({ get: () => Promise.resolve(saved) })]]),
            {},
            CONTEXT,
        )
        expect(result).toMatchObject({
            ok: true,
            data: { rows: [{ kind: "vat", unit: "month", period: 10 }, { kind: "pit" }] },
        })
    })

    it("is read with the view permission", () => {
        expect(dueSoonRead.permission).toBe("accounting.view")
    })
})
