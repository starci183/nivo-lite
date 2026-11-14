import type { ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import { ACCOUNTANT_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"

const run = (read: ReadDefinition, world: MemoryWorld, raw: unknown = {}): Promise<ReadRunResult> =>
    read.execute?.(memoryProvider(world), raw, ACCOUNTANT_CONTEXT) ?? Promise.resolve({ ok: false, problems: [] })
import { ACCOUNTING_SETTINGS_DEFAULTS } from "../rules/settings"
import { putSettings } from "../fixtures/accounting.memory"
import { settingsRead } from "./settings.read"

describe("the blocks-core.sales.api.ledger-settings.get read", () => {
    it("answers the defaults before the first save", async () => {
        await expect(run(settingsRead, memoryWorld())).resolves.toEqual({
            ok: true,
            data: ACCOUNTING_SETTINGS_DEFAULTS,
        })
    })

    it("answers what the workspace saved", async () => {
        const world = memoryWorld()
        putSettings(world, { ...ACCOUNTING_SETTINGS_DEFAULTS, vatPeriod: "monthly", postUnmatched: true })
        await expect(run(settingsRead, world)).resolves.toEqual({
            ok: true,
            data: { ...ACCOUNTING_SETTINGS_DEFAULTS, vatPeriod: "monthly", postUnmatched: true },
        })
    })

    it("is read with the view permission", () => {
        expect(settingsRead.permission).toBe("sales.view")
    })
})
