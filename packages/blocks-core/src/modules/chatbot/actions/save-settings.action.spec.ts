import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { CHATBOT_SETTINGS_DEFAULTS } from "../../../rules/chatbot/settings"
import { MANAGER_ID, STAFF_CONTEXT, memoryProvider, memoryWorld, settingsApi } from "../fixtures/chatbot.memory"
import type { MemoryWorld } from "../fixtures/chatbot.memory"
import { SETTINGS } from "../ports"
import { SETTINGS_READ } from "../reads/settings.read"
import { SAVE_SETTINGS } from "./save-settings.action"

const save = (world: MemoryWorld, input: unknown, memberId: string | null = MANAGER_ID) =>
    SAVE_SETTINGS.execute?.(memoryProvider(world), input, { ...STAFF_CONTEXT, memberId })

describe("the chatbot.save-settings action", () => {
    it("is for owners and managers: its own permission, a different one from replying", () => {
        expect(SAVE_SETTINGS.permission).toBe("chatbot.manage")
        expect(SAVE_SETTINGS.transactional).toBe(true)
        expect(SAVE_SETTINGS.refreshes).toEqual(["chatbot.settings"])
    })

    it("saves the rules as the one settings record, with who saved them, the holding message without the blanks around it", async () => {
        const world = memoryWorld()
        expect(await save(world, { openclawTimeoutSec: 40, holdingMessage: "  Please wait  " })).toEqual({ ok: true })
        expect(world.settings).toHaveLength(1)
        expect(world.settings[0]?.data).toEqual({
            scope: "chatbot",
            openclawTimeoutSec: 40,
            holdingMessage: "Please wait",
            updatedBy: "Lan Pham",
        })
        expect(await save(world, { openclawTimeoutSec: 60, holdingMessage: "Wait" })).toEqual({ ok: true })
        expect(world.settings).toHaveLength(1)
        expect(world.settings[0]?.data).toMatchObject({ openclawTimeoutSec: 60, holdingMessage: "Wait" })
    })

    it("refuses a timeout out of 5 to 120 seconds and a holding message too long, each on its own field, and saves nothing", async () => {
        const world = memoryWorld()
        const result = await save(world, { openclawTimeoutSec: 3, holdingMessage: "a".repeat(401) })
        expect(result).toEqual({
            ok: false,
            reason: "invalid",
            message: { key: "rules_error_timeout_range" },
            fields: {
                openclawTimeoutSec: { key: "rules_error_timeout_range" },
                holdingMessage: { key: "rules_error_holding_too_long" },
            },
        })
        expect(world.settings).toEqual([])
    })

    it("refuses a caller who is not a member of the workspace", async () => {
        const world = memoryWorld()
        const input = { openclawTimeoutSec: 30, holdingMessage: "Wait" }
        expect(await save(world, input, null)).toMatchObject({ ok: false, reason: "forbidden" })
        expect(await save(world, input, "stranger")).toMatchObject({ ok: false, reason: "forbidden" })
        expect(world.settings).toEqual([])
    })

    it("answers a conflict when the record moved under the write", async () => {
        const world = memoryWorld()
        const base = memoryProvider(world)
        const provider = {
            implementationOf: (port: PortDefinition<unknown>): unknown =>
                port.id === SETTINGS.id
                    ? { ...settingsApi(world), upsert: () => Promise.resolve({ ok: false, reason: "stale" }) }
                    : base.implementationOf(port),
        }
        const input = { openclawTimeoutSec: 30, holdingMessage: "Wait" }
        expect(
            await SAVE_SETTINGS.execute?.(provider, input, { ...STAFF_CONTEXT, memberId: MANAGER_ID }),
        ).toMatchObject({
            ok: false,
            reason: "conflict",
        })
    })

    it("refuses what it does not declare", async () => {
        expect(await save(memoryWorld(), { openclawTimeoutSec: 30, holdingMessage: "Wait", extra: 1 })).toEqual({
            ok: false,
            reason: "invalid",
            message: { key: "renderer.invalid" },
            fields: { extra: { key: "renderer.invalid" } },
        })
    })
})

describe("the chatbot.settings read", () => {
    it("answers the defaults before the first save", async () => {
        const result = await SETTINGS_READ.execute?.(memoryProvider(memoryWorld()), {}, STAFF_CONTEXT)
        expect(result).toEqual({ ok: true, data: { ...CHATBOT_SETTINGS_DEFAULTS, updatedBy: "" } })
    })

    it("answers what was saved", async () => {
        const world = memoryWorld()
        await save(world, { openclawTimeoutSec: 60, holdingMessage: "Wait" })
        expect(await SETTINGS_READ.execute?.(memoryProvider(world), {}, STAFF_CONTEXT)).toEqual({
            ok: true,
            data: { openclawTimeoutSec: 60, holdingMessage: "Wait", updatedBy: "Lan Pham" },
        })
        expect(SETTINGS_READ.permission).toBe("chatbot.view")
    })

    it("answers the defaults for a record whose fields are not the rules", async () => {
        const world = memoryWorld()
        world.settings.push({
            id: "s1",
            workspaceId: "w1",
            version: "1",
            createdAt: "2026-11-03T09:00:00.000Z",
            updatedAt: "2026-11-03T09:00:00.000Z",
            data: { scope: "chatbot", openclawTimeoutSec: "soon" },
        })
        expect(await SETTINGS_READ.execute?.(memoryProvider(world), {}, STAFF_CONTEXT)).toEqual({
            ok: true,
            data: { ...CHATBOT_SETTINGS_DEFAULTS, updatedBy: "" },
        })
    })
})
