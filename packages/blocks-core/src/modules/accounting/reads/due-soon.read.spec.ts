import type { ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import { ACCOUNTANT_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"

const run = (read: ReadDefinition, world: MemoryWorld, raw: unknown = {}): Promise<ReadRunResult> =>
    read.execute?.(memoryProvider(world), raw, ACCOUNTANT_CONTEXT) ?? Promise.resolve({ ok: false, problems: [] })
import { ACCOUNTING_SETTINGS_DEFAULTS } from "../../../rules/accounting/settings"
import { putSettings } from "../fixtures/accounting.memory"
import { dueSoonRead } from "./due-soon.read"

describe("the accounting.due-soon read", () => {
    it("lists the declarations that fall due within 30 days of now, value added tax by quarter by default", async () => {
        await expect(run(dueSoonRead, memoryWorld())).resolves.toMatchObject({
            ok: true,
            data: { rows: [{ kind: "pit", unit: "month", period: 10 }] },
        })
    })

    it("follows the filing period the workspace chose", async () => {
        const world = memoryWorld()
        putSettings(world, { ...ACCOUNTING_SETTINGS_DEFAULTS, vatPeriod: "monthly" })
        await expect(run(dueSoonRead, world)).resolves.toMatchObject({
            ok: true,
            data: { rows: [{ kind: "vat", unit: "month", period: 10 }, { kind: "pit" }] },
        })
    })

    it("is read with the view permission", () => {
        expect(dueSoonRead.permission).toBe("accounting.view")
    })
})
