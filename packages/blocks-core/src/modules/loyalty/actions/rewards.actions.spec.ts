import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { sampleState, SAMPLE_NOW } from "../fixtures/loyalty.data"
import { memoryProvider } from "../memory"
import type { MemoryState } from "../memory"
import { loyaltyRewards } from "../ports"
import { addPresetRewardsAction, removeRewardAction, saveRewardAction } from "./rewards.actions"

const contextOf = (memberId: string | null): RunContext => ({
    workspaceId: "w1",
    memberId,
    now: new Date(SAMPLE_NOW),
    timeZone: "Asia/Ho_Chi_Minh",
})

/** What running stands in for an action that does not run in the package, which the expectation before it already failed. */
const notRunnable = (): Promise<ActionResult> =>
    Promise.resolve({ ok: false, reason: "failed", message: { key: "not_runnable" } })

const run = (
    action: ActionDefinition,
    raw: unknown,
    state: MemoryState = sampleState(),
    memberId: string | null = "staff-1",
    provider: PortProvider = memoryProvider(state),
): Promise<ActionResult> => {
    expect(action.execute).toBeDefined()
    return (action.execute ?? notRunnable)(provider, raw, contextOf(memberId))
}

/** A provider whose port `id` answers as the given overrides say, and every other port as the memory does. */
const overriding = (state: MemoryState, id: string, overrides: Record<string, unknown>): PortProvider => {
    const provider = memoryProvider(state)
    return {
        implementationOf: (port) => {
            const implementation = provider.implementationOf(port)
            if (port.id !== id || typeof implementation !== "object" || implementation === null) return implementation
            return { ...implementation, ...overrides }
        },
    }
}

describe("loyalty.save-reward", () => {
    it("creates a reward with a key made from its name", async () => {
        const state = sampleState()
        expect(
            await run(
                saveRewardAction,
                { name: " Free Coffee ", kind: "item", pointsCost: 300, valueVnd: 40_000 },
                state,
            ),
        ).toEqual({ ok: true, data: { id: "r-4" } })
        expect(state.rewards.at(-1)).toMatchObject({
            key: "free-coffee",
            name: "Free Coffee",
            kind: "item",
            pointsCost: 300,
            stock: null,
            active: true,
        })
    })

    it("changes the reward the id names and keeps its key; an empty id creates", async () => {
        const state = sampleState()
        await run(
            saveRewardAction,
            { id: "r-2", name: "15% off", kind: "percent", pointsCost: 900, percent: 15, active: false, note: "n" },
            state,
        )
        expect(state.rewards.find((reward) => reward.id === "r-2")).toMatchObject({
            key: "giam-10",
            name: "15% off",
            percent: 15,
            active: false,
            version: "2",
        })
        await run(saveRewardAction, { id: "", name: "New", kind: "voucher", pointsCost: 1 }, state)
        expect(state.rewards).toHaveLength(4)
    })

    it("refuses as data a reward that is gone, and answers a conflict when the store does", async () => {
        expect(await run(saveRewardAction, { id: "nobody", name: "x", kind: "voucher", pointsCost: 1 })).toMatchObject({
            message: { key: "refusal_reward_missing" },
        })
        const state = sampleState()
        const conflict = overriding(state, loyaltyRewards.id, {
            save: () => Promise.resolve({ ok: false, reason: "conflict" }),
        })
        expect(
            await run(saveRewardAction, { name: "x", kind: "voucher", pointsCost: 1 }, state, "s", conflict),
        ).toMatchObject({ reason: "conflict" })
    })

    it("answers invalid for a blank name, a kind that does not exist and a cost below one", async () => {
        expect(await run(saveRewardAction, { name: " ", kind: "gift", pointsCost: 0 })).toMatchObject({
            reason: "invalid",
            fields: {
                name: { key: "renderer.invalid" },
                kind: { key: "renderer.invalid" },
                pointsCost: { key: "renderer.invalid" },
            },
        })
    })
})

describe("loyalty.remove-reward and loyalty.add-preset-rewards", () => {
    it("deletes a reward nobody redeemed and pauses one with history", async () => {
        const state = sampleState()
        expect(await run(removeRewardAction, { id: "r-2" }, state)).toEqual({ ok: true, data: { removal: "deleted" } })
        expect(state.rewards.map((reward) => reward.id)).toEqual(["r-1", "r-3"])
        expect(await run(removeRewardAction, { id: "r-1" }, state)).toEqual({ ok: true, data: { removal: "retired" } })
        expect(state.rewards.find((reward) => reward.id === "r-1")?.active).toBe(false)
    })

    it("refuses as data a reward that is gone", async () => {
        expect(await run(removeRewardAction, { id: "nobody" })).toMatchObject({
            message: { key: "refusal_reward_missing" },
        })
    })

    it("adds the starter rewards the catalogue lacks, written in Vietnamese", async () => {
        const state = sampleState()
        expect(await run(addPresetRewardsAction, {}, state)).toEqual({ ok: true, data: { added: 0 } })
        state.rewards.splice(0)
        expect(await run(addPresetRewardsAction, { id: "" }, state)).toEqual({ ok: true, data: { added: 3 } })
        expect(state.rewards.map((reward) => reward.key)).toEqual(["voucher-50k", "giam-10", "qua-tang"])
        expect(state.rewards.every((reward) => !reward.name.startsWith("preset_"))).toBe(true)
    })
})
