import { portsOf } from "@nivo-lite/agent-sdk/port"
import { SALES_SETTINGS_DEFAULTS } from "./rules/settings"
import { sampleState } from "./fixtures/sales.data"
import { salesContextOf } from "./fixtures/sales.context"
import { memoryProvider } from "./memory"
import { salesLeads, salesSettings } from "./ports"
import { saveSettings, settingsOf } from "./settings-store"
import { waitingFilterOf, waitingOrdersOf } from "./reads/waiting-orders"
import { salesOrders } from "./ports"
import { settingsRead } from "./reads/settings.read"
import { saveSettingsAction } from "./actions/save-settings.action"

const portsFor = (state = sampleState([])) =>
    portsOf(memoryProvider(state), { leads: salesLeads, settings: salesSettings, orders: salesOrders })

describe("the sales settings of a workspace", () => {
    it("are the defaults before the first save", async () => {
        expect(await settingsOf(portsFor().settings)).toEqual(SALES_SETTINGS_DEFAULTS)
    })

    it("are the ones saved, and a second save replaces them", async () => {
        const state = sampleState([])
        const { settings } = portsFor(state)
        expect(await saveSettings(settings, { ...SALES_SETTINGS_DEFAULTS, approvalThresholdVnd: 1_000_000 })).toBe(true)
        expect((await settingsOf(settings)).approvalThresholdVnd).toBe(1_000_000)
        expect(await saveSettings(settings, { ...SALES_SETTINGS_DEFAULTS, closedDealsCanFlip: false })).toBe(true)
        expect(await settingsOf(settings)).toEqual({ ...SALES_SETTINGS_DEFAULTS, closedDealsCanFlip: false })
    })

    it("are refused by the engine when the values are not settings", async () => {
        const { settings } = portsFor()
        expect(await saveSettings(settings, { ...SALES_SETTINGS_DEFAULTS, approvalThresholdVnd: -1 })).toBe(false)
    })
})

describe("the orders that wait for the owner", () => {
    it("are the drafts at the threshold or above, or without a total when the settings say so", () => {
        expect(waitingFilterOf(SALES_SETTINGS_DEFAULTS)).toMatchObject({ op: "and" })
        expect(JSON.stringify(waitingFilterOf(SALES_SETTINGS_DEFAULTS))).toContain("isNull")
        expect(
            JSON.stringify(waitingFilterOf({ ...SALES_SETTINGS_DEFAULTS, draftWithoutTotalNeedsApproval: false })),
        ).not.toContain("isNull")
    })

    it("are listed oldest first with the customer, and counted", async () => {
        const waiting = await waitingOrdersOf(portsFor())
        expect(waiting.total).toBe(1)
        expect(waiting.rows.map((order) => order.id)).toEqual(["order-1"])
    })

    it("count by the threshold the workspace saved", async () => {
        const state = sampleState([])
        const ports = portsFor(state)
        await saveSettings(ports.settings, { ...SALES_SETTINGS_DEFAULTS, approvalThresholdVnd: 100_000 })
        expect((await waitingOrdersOf(ports)).total).toBe(2)
    })
})

const CONTEXT = salesContextOf()

describe("blocks-core.sales.settings and sales.save-settings", () => {
    it("read the defaults and then what was saved", async () => {
        const state = sampleState([])
        const provider = memoryProvider(state)
        expect(await settingsRead.execute?.(provider, {}, CONTEXT)).toEqual({
            ok: true,
            data: { ...SALES_SETTINGS_DEFAULTS, savedAt: null },
        })
        await saveSettingsAction.execute?.(provider, { closedDealsCanFlip: false }, CONTEXT)
        expect(await settingsRead.execute?.(provider, {}, CONTEXT)).toEqual({
            ok: true,
            data: { ...SALES_SETTINGS_DEFAULTS, closedDealsCanFlip: false, savedAt: "2026-11-05T09:00:00.000Z" },
        })
    })

    it("refuse as data when the engine does not take the settings", async () => {
        const provider = memoryProvider(sampleState([]))
        const failing = {
            implementationOf: (port: Parameters<typeof provider.implementationOf>[0]): unknown => {
                const implementation = provider.implementationOf(port)
                return port.id === salesSettings.id && typeof implementation === "object" && implementation !== null
                    ? { ...implementation, upsert: () => Promise.resolve({ ok: false, reason: "invalid" }) }
                    : implementation
            },
        }
        expect(await saveSettingsAction.execute?.(failing, {}, CONTEXT)).toMatchObject({
            ok: false,
            reason: "refused",
            message: { key: "refusal_settings_not_saved" },
        })
    })
})
