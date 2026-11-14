import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import type { MemoryWorld } from "../../ledger/fixtures/accounting.memory"
import { rowsOf } from "../../ledger/fixtures/accounting.memory"
import { SAMPLE_NOW } from "../fixtures/loyalty.data"
import { loyaltyProvider, rewardsIn, sampleWorld, withEntity } from "../fixtures/loyalty.memory"
import { addPresetRewardsAction, removeRewardAction, saveRewardAction } from "./rewards.actions"

const contextOf = (memberId: string | null): RunContext => ({
    workspaceId: "w1",
    memberId,
    now: new Date(SAMPLE_NOW),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
})

/** What running stands in for an action that does not run in the package, which the expectation before it already failed. */
const notRunnable = (): Promise<ActionResult> =>
    Promise.resolve({ ok: false, reason: "failed", message: { key: "not_runnable" } })

const run = (
    action: ActionDefinition,
    raw: unknown,
    world: MemoryWorld = sampleWorld(),
    memberId: string | null = "staff-1",
    provider: PortProvider = loyaltyProvider(world),
): Promise<ActionResult> => {
    expect(action.execute).toBeDefined()
    return (action.execute ?? notRunnable)(provider, raw, contextOf(memberId))
}

describe("sales.loyalty-save-reward", () => {
    it("creates a reward with a key made from its name, and a suffixed key for a name taken", async () => {
        const world = sampleWorld()
        const result = await run(
            saveRewardAction,
            { name: " Free Coffee ", kind: "item", pointsCost: 300, valueVnd: 40_000 },
            world,
        )
        expect(result).toMatchObject({ ok: true })
        expect(rewardsIn(world)).toHaveLength(4)
        expect(rewardsIn(world).at(-1)).toMatchObject({
            key: "free-coffee",
            name: "Free Coffee",
            kind: "item",
            pointsCost: 300,
            stock: null,
            active: true,
        })
        await run(saveRewardAction, { name: "Free Coffee", kind: "item", pointsCost: 300 }, world)
        await run(saveRewardAction, { name: "Free Coffee", kind: "item", pointsCost: 300 }, world)
        expect(rewardsIn(world).map((reward) => reward.key)).toEqual([
            "voucher-50k",
            "giam-10",
            "qua-tang",
            "free-coffee",
            "free-coffee-2",
            "free-coffee-3",
        ])
    })

    it("changes the reward the id names and keeps its key; an empty id creates", async () => {
        const world = sampleWorld()
        await run(
            saveRewardAction,
            { id: "r-2", name: "15% off", kind: "percent", pointsCost: 900, percent: 15, active: false, note: "n" },
            world,
        )
        expect(rewardsIn(world).find((reward) => reward.id === "r-2")).toMatchObject({
            key: "giam-10",
            name: "15% off",
            percent: 15,
            active: false,
            version: "2",
        })
        await run(saveRewardAction, { id: "", name: "New", kind: "voucher", pointsCost: 1 }, world)
        expect(rewardsIn(world)).toHaveLength(4)
    })

    it("refuses as data a reward that is gone, and answers a conflict when the write is stale or the key never frees", async () => {
        expect(await run(saveRewardAction, { id: "nobody", name: "x", kind: "voucher", pointsCost: 1 })).toMatchObject({
            message: { key: "loyalty_refusal_reward_missing" },
        })
        const world = sampleWorld()
        const stale = withEntity(world, "blocks-core.sales.loyalty-reward", {
            update: () => Promise.resolve({ ok: false, reason: "stale" }),
        })
        expect(
            await run(saveRewardAction, { id: "r-2", name: "x", kind: "voucher", pointsCost: 1 }, world, "s", stale),
        ).toMatchObject({ reason: "conflict" })
        const taken = withEntity(world, "blocks-core.sales.loyalty-reward", {
            insert: () => Promise.resolve({ ok: false, reason: "taken", constraint: "key_key", refusal: "taken" }),
        })
        expect(
            await run(saveRewardAction, { name: "x", kind: "voucher", pointsCost: 1 }, world, "s", taken),
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

describe("sales.loyalty-remove-reward and sales.loyalty-add-preset-rewards", () => {
    it("deletes a reward nobody redeemed and pauses one with history", async () => {
        const world = sampleWorld()
        expect(await run(removeRewardAction, { id: "r-2" }, world)).toEqual({ ok: true, data: { removal: "deleted" } })
        expect(rewardsIn(world).map((reward) => reward.id)).toEqual(["r-1", "r-3"])
        expect(await run(removeRewardAction, { id: "r-1" }, world)).toEqual({ ok: true, data: { removal: "retired" } })
        expect(rewardsIn(world).find((reward) => reward.id === "r-1")?.active).toBe(false)
    })

    it("refuses as data a reward that is gone, or one the engine will not change", async () => {
        expect(await run(removeRewardAction, { id: "nobody" })).toMatchObject({
            message: { key: "loyalty_refusal_reward_missing" },
        })
        const world = sampleWorld()
        const stale = withEntity(world, "blocks-core.sales.loyalty-reward", {
            update: () => Promise.resolve({ ok: false, reason: "stale" }),
            delete: () => Promise.resolve({ ok: false, reason: "stale" }),
        })
        expect(await run(removeRewardAction, { id: "r-1" }, world, "s", stale)).toMatchObject({
            message: { key: "loyalty_refusal_reward_missing" },
        })
        expect(await run(removeRewardAction, { id: "r-2" }, world, "s", stale)).toMatchObject({
            message: { key: "loyalty_refusal_reward_missing" },
        })
    })

    it("adds the starter rewards the catalogue lacks, written in Vietnamese", async () => {
        const world = sampleWorld()
        expect(await run(addPresetRewardsAction, {}, world)).toEqual({ ok: true, data: { added: 0 } })
        rowsOf(world, "blocks-core.sales.loyalty-reward").splice(0)
        expect(await run(addPresetRewardsAction, { id: "" }, world)).toEqual({ ok: true, data: { added: 3 } })
        expect(
            rewardsIn(world)
                .map((reward) => reward.key)
                .toSorted(),
        ).toEqual(["giam-10", "qua-tang", "voucher-50k"])
        expect(rewardsIn(world).every((reward) => !reward.name.startsWith("preset_"))).toBe(true)
    })

    it("counts only the rewards the engine wrote", async () => {
        const world = sampleWorld()
        rowsOf(world, "blocks-core.sales.loyalty-reward").splice(0)
        const refused = withEntity(world, "blocks-core.sales.loyalty-reward", {
            insert: () => Promise.resolve({ ok: false, reason: "invalid" }),
        })
        expect(await run(addPresetRewardsAction, {}, world, "s", refused)).toEqual({ ok: true, data: { added: 0 } })
    })
})
