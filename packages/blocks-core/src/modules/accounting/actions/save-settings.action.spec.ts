import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import { ACCOUNTING_SETTINGS_DEFAULTS } from "../../../rules/accounting/settings"
import { ACCOUNTANT_CONTEXT, memoryProvider, memoryWorld, putSettings, rowsOf } from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { saveSettingsAction } from "./save-settings.action"

const run = (world: MemoryWorld, raw: unknown): Promise<ActionResult> =>
    saveSettingsAction.execute?.(memoryProvider(world), raw, ACCOUNTANT_CONTEXT) ??
    Promise.reject(new Error("not runnable"))

const savedOf = (world: MemoryWorld): unknown => {
    const [row] = rowsOf(world, "accounting.settings")
    return row?.data
}

describe("accounting.save-settings", () => {
    it("saves the values given on top of the defaults before the first save", async () => {
        const world = memoryWorld()
        expect(await run(world, { postUnmatched: true, voidMode: "none" })).toEqual({ ok: true })
        expect(savedOf(world)).toEqual({
            scope: "workspace",
            ...ACCOUNTING_SETTINGS_DEFAULTS,
            postUnmatched: true,
            voidMode: "none",
        })
    })

    it("keeps the saved value of what is left empty, and rewrites the one row", async () => {
        const world = memoryWorld()
        putSettings(world, { ...ACCOUNTING_SETTINGS_DEFAULTS, postExpenses: false, voidMode: "none" })
        await run(world, {
            id: "",
            postExpenses: null,
            postOutgoing: false,
            postUnmatched: null,
            voidMode: null,
            vatPeriod: null,
        })
        expect(rowsOf(world, "accounting.settings")).toHaveLength(1)
        expect(savedOf(world)).toMatchObject({ postExpenses: false, postOutgoing: false, voidMode: "none" })
    })

    it("saves the filing period of value added tax", async () => {
        const world = memoryWorld()
        await run(world, { vatPeriod: "monthly" })
        expect(savedOf(world)).toMatchObject({ vatPeriod: "monthly" })
        await run(world, { rematchDays: 14 })
        expect(savedOf(world)).toMatchObject({ vatPeriod: "monthly", rematchDays: 14 })
    })

    it("refuses a void mode or a filing period it does not know", async () => {
        const world = memoryWorld()
        expect(await run(world, { voidMode: "delete" })).toMatchObject({ ok: false, reason: "invalid" })
        expect(await run(world, { vatPeriod: "yearly" })).toMatchObject({ ok: false, reason: "invalid" })
        expect(await run(world, { rematchDays: 0 })).toMatchObject({ ok: false, reason: "invalid" })
        expect(await run(world, { rematchDays: 31 })).toMatchObject({ ok: false, reason: "invalid" })
        expect(rowsOf(world, "accounting.settings")).toEqual([])
    })

    it("is a transactional action of the manage permission that refreshes what the settings change", () => {
        expect(saveSettingsAction).toMatchObject({ id: "accounting.save-settings", permission: "accounting.manage" })
        expect(saveSettingsAction.transactional).toBe(true)
    })
})
