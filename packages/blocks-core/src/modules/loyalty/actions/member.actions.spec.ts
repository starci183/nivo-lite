import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { sampleState, SAMPLE_NOW, SAMPLE_PROGRAM, REWARD_VOUCHER } from "../fixtures/loyalty.data"
import { memoryProvider } from "../memory"
import type { MemoryState } from "../memory"
import { loyaltyLedger, loyaltyMembers } from "../ports"
import { adjustPointsAction, recordPurchaseAction, redeemRewardAction, updateMemberAction } from "./member.actions"

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

const pointsOf = (state: MemoryState, id: string): number | undefined =>
    state.members.find((member) => member.id === id)?.points

describe("loyalty.adjust-points", () => {
    it("adds points with the reason and the person who corrected on the ledger", async () => {
        const state = sampleState()
        expect(
            await run(adjustPointsAction, { id: "m-3", points: 25.4, reason: "  Goodwill  ", token: "t1" }, state),
        ).toEqual({
            ok: true,
            data: { posted: true },
        })
        expect(pointsOf(state, "m-3")).toBe(205)
        expect(state.entries.at(-1)).toMatchObject({
            kind: "adjust",
            points: 25,
            ref: "adjust:t1",
            by: "staff-1",
            evidence: "Goodwill",
        })
    })

    it("adjusts once for one token, and the agent signs as NIVO", async () => {
        const state = sampleState()
        const input = { id: "m-3", points: -10, reason: "Refund", token: "t2" }
        await run(adjustPointsAction, input, state, null)
        expect(await run(adjustPointsAction, input, state, null)).toEqual({ ok: true, data: { posted: false } })
        expect(pointsOf(state, "m-3")).toBe(170)
        expect(state.entries.at(-1)?.by).toBe("NIVO")
    })

    it("keys an adjustment without a token by the member and the instant", async () => {
        const state = sampleState()
        await run(adjustPointsAction, { id: "m-3", points: 5, reason: "Gift" }, state)
        expect(state.entries.at(-1)?.ref).toBe(`adjust:m-3:${SAMPLE_NOW}`)
    })

    it("refuses as data a missing member, zero points and a blank reason", async () => {
        expect(await run(adjustPointsAction, { id: "nobody", points: 5, reason: "x" })).toMatchObject({
            ok: false,
            reason: "refused",
            message: { key: "refusal_member_missing" },
        })
        expect(await run(adjustPointsAction, { id: "m-3", points: 0.2, reason: "x" })).toMatchObject({
            message: { key: "refusal_points_required" },
        })
        expect(await run(adjustPointsAction, { id: "m-3", points: 5, reason: "   " })).toMatchObject({
            message: { key: "refusal_reason_required" },
        })
    })

    it("answers invalid, naming the field, for a value the schema refuses or a key it does not declare", async () => {
        expect(await run(adjustPointsAction, { id: "m-3", points: null, reason: "x" })).toMatchObject({
            ok: false,
            reason: "invalid",
            fields: { points: { key: "renderer.invalid" } },
        })
        expect(await run(adjustPointsAction, { id: "m-3", points: 5, reason: "x", other: 1 })).toMatchObject({
            reason: "invalid",
        })
    })
})

describe("loyalty.update-member", () => {
    it("changes the name, the birthday and the note, and moves the version", async () => {
        const state = sampleState()
        expect(
            await run(updateMemberAction, { id: "m-3", name: " Le Chau ", birthday: "1995-04-05", note: "VIP" }, state),
        ).toEqual({ ok: true, data: { id: "m-3" } })
        expect(state.members.find((member) => member.id === "m-3")).toMatchObject({
            name: "Le Chau",
            birthday: "1995-04-05",
            note: "VIP",
            version: "2",
        })
    })

    it("clears the birthday with an empty value or null, and keeps the note when none is sent", async () => {
        const state = sampleState()
        await run(updateMemberAction, { id: "m-1", name: "Lan", birthday: "" }, state)
        expect(state.members.find((member) => member.id === "m-1")).toMatchObject({
            birthday: null,
            note: "Prefers oat milk",
        })
        await run(updateMemberAction, { id: "m-3", name: "Chau", birthday: null }, state)
        expect(state.members.find((member) => member.id === "m-3")?.birthday).toBeNull()
        await run(updateMemberAction, { id: "m-5", name: "Nam" }, state)
        expect(state.members.find((member) => member.id === "m-5")?.birthday).toBeNull()
    })

    it("refuses as data a missing member and a birthday that is no real day", async () => {
        expect(await run(updateMemberAction, { id: "nobody", name: "x" })).toMatchObject({
            message: { key: "refusal_member_missing" },
        })
        expect(await run(updateMemberAction, { id: "m-3", name: "x", birthday: "1995-02-30" })).toMatchObject({
            message: { key: "refusal_birthday_invalid" },
        })
    })

    it("answers a conflict when another writer got there first, and a missing member when it vanished", async () => {
        const state = sampleState()
        const conflict = overriding(state, loyaltyMembers.id, {
            update: () => Promise.resolve({ ok: false, reason: "conflict" }),
        })
        expect(await run(updateMemberAction, { id: "m-3", name: "x" }, state, "staff-1", conflict)).toMatchObject({
            ok: false,
            reason: "conflict",
        })
        const gone = overriding(state, loyaltyMembers.id, {
            update: () => Promise.resolve({ ok: false, reason: "missing" }),
        })
        expect(await run(updateMemberAction, { id: "m-3", name: "x" }, state, "staff-1", gone)).toMatchObject({
            message: { key: "refusal_member_missing" },
        })
    })

    it("answers invalid for a blank name", async () => {
        expect(await run(updateMemberAction, { id: "m-3", name: "   " })).toMatchObject({
            reason: "invalid",
            fields: { name: { key: "renderer.invalid" } },
        })
    })
})

describe("loyalty.redeem-reward", () => {
    it("takes the points of the reward, writes the redemption and gives the code", async () => {
        const state = sampleState()
        const result = await run(redeemRewardAction, { id: "m-1/r-1", token: "t1" }, state)
        expect(result).toEqual({ ok: true, data: { code: "QT-DEEMT1", posted: true } })
        expect(pointsOf(state, "m-1")).toBe(950)
        expect(state.entries.at(-1)).toMatchObject({
            kind: "redeem",
            points: -500,
            rewardId: "r-1",
            ref: "redeem:t1",
            evidence: "50,000 VND voucher QT-DEEMT1",
        })
    })

    it("redeems once for one token, and the agent signs as NIVO", async () => {
        const state = sampleState()
        await run(redeemRewardAction, { id: "m-1/r-1", token: "t2" }, state, null)
        expect(await run(redeemRewardAction, { id: "m-1/r-1", token: "t2" }, state, null)).toEqual({
            ok: true,
            data: { code: "QT-DEEMT2", posted: false },
        })
        expect(pointsOf(state, "m-1")).toBe(950)
        expect(state.entries.at(-1)?.by).toBe("NIVO")
    })

    it("keys a redemption without a token by the offer and the instant", async () => {
        const state = sampleState()
        await run(redeemRewardAction, { id: "m-1/r-1" }, state)
        expect(state.entries.at(-1)?.ref).toBe(`redeem:m-1/r-1:${SAMPLE_NOW}`)
    })

    it("takes one from the stock of a reward that has stock", async () => {
        const state = sampleState()
        state.rewards.splice(0, 1, { ...REWARD_VOUCHER, stock: 2 })
        await run(redeemRewardAction, { id: "m-1/r-1", token: "t3" }, state)
        expect(state.rewards.find((reward) => reward.id === "r-1")?.stock).toBe(1)
    })

    it("does not touch the stock when the ledger already had the entry", async () => {
        const state = sampleState()
        const lost = overriding(state, loyaltyLedger.id, {
            hasRef: () => Promise.resolve(false),
            post: () => Promise.resolve(null),
        })
        expect(await run(redeemRewardAction, { id: "m-1/r-1", token: "t4" }, state, "staff-1", lost)).toMatchObject({
            ok: true,
            data: { posted: false },
        })
        expect(pointsOf(state, "m-1")).toBe(1450)
    })

    it("refuses as data an id that names not both, a missing member and a missing reward", async () => {
        expect(await run(redeemRewardAction, { id: "m-1" })).toMatchObject({
            message: { key: "refusal_redeem_key_invalid" },
        })
        expect(await run(redeemRewardAction, { id: "nobody/r-1" })).toMatchObject({
            message: { key: "refusal_member_missing" },
        })
        expect(await run(redeemRewardAction, { id: "m-1/nothing" })).toMatchObject({
            message: { key: "refusal_reward_missing" },
        })
    })

    it("refuses a redemption the rules block, with the reason as the message", async () => {
        const state = sampleState()
        expect(await run(redeemRewardAction, { id: "m-4/r-1" }, state)).toMatchObject({
            message: { key: "refusal_not_redeemable_not_enough_points" },
        })
        expect(await run(redeemRewardAction, { id: "m-1/r-3" }, state)).toMatchObject({
            message: { key: "refusal_not_redeemable_inactive" },
        })
        expect(pointsOf(state, "m-1")).toBe(1450)
    })
})

describe("loyalty.record-purchase", () => {
    it("earns the points of a sale for a new phone and creates the customer", async () => {
        const state = sampleState()
        const result = await run(
            recordPurchaseAction,
            { phone: "0922 111 000", name: "  Bui An  ", amountVnd: 200_000, items: "coffee", ref: "sale-9" },
            state,
        )
        expect(result).toEqual({ ok: true, data: { status: "done", points: 200 } })
        expect(state.members.at(-1)).toMatchObject({
            name: "Bui An",
            phone: "84922111000",
            points: 200,
            tierKey: "dong",
        })
        expect(state.entries.at(-1)).toMatchObject({
            kind: "earn",
            points: 200,
            amountVnd: 200_000,
            evidence: "1/1k",
            expiresAt: "2027-11-05T05:00:00.000Z",
        })
    })

    it("names the customer after the phone when no name is given", async () => {
        const state = sampleState()
        await run(recordPurchaseAction, { phone: "0922111000", amountVnd: 50_000, ref: "sale-10" }, state)
        expect(state.members.at(-1)?.name).toBe("84922111000")
    })

    it("lifts the customer to the tier the lifetime spend reaches", async () => {
        const state = sampleState()
        const result = await run(
            recordPurchaseAction,
            { phone: "84901112233", amountVnd: 3_000_000, ref: "sale-11" },
            state,
        )
        expect(result).toEqual({ ok: true, data: { status: "done", points: 3000 } })
        expect(state.members.find((member) => member.id === "m-3")).toMatchObject({ tierKey: "bac" })
    })

    it("leaves a customer at the top tier where they are", async () => {
        const state = sampleState()
        await run(recordPurchaseAction, { phone: "84912345678", amountVnd: 100_000, ref: "sale-12" }, state)
        expect(state.members.find((member) => member.id === "m-1")).toMatchObject({ tierKey: "vang", version: "1" })
    })

    it("lifts nobody in a programme without tiers, or when the customer cannot be read again", async () => {
        const bare = sampleState({ program: { ...SAMPLE_PROGRAM, config: { ...SAMPLE_PROGRAM.config, tiers: [] } } })
        expect(
            await run(recordPurchaseAction, { phone: "84901112233", amountVnd: 100_000, ref: "sale-13" }, bare),
        ).toMatchObject({ data: { status: "done" } })
        expect(bare.members.find((member) => member.id === "m-3")?.tierKey).toBe("dong")
        const state = sampleState()
        const unreadable = overriding(state, loyaltyMembers.id, {
            get: () => Promise.resolve(null),
        })
        expect(
            await run(
                recordPurchaseAction,
                { phone: "84901112233", amountVnd: 3_000_000, ref: "sale-14" },
                state,
                "s",
                unreadable,
            ),
        ).toMatchObject({ data: { status: "done" } })
    })

    it("earns once for one ref, and nothing below the smallest order", async () => {
        const state = sampleState()
        const input = { phone: "84901112233", amountVnd: 100_000, ref: "sale-15" }
        await run(recordPurchaseAction, input, state)
        expect(await run(recordPurchaseAction, input, state)).toEqual({
            ok: true,
            data: { status: "duplicate", points: 0 },
        })
        const strict = sampleState({
            program: {
                ...SAMPLE_PROGRAM,
                config: { ...SAMPLE_PROGRAM.config, earn: { ...SAMPLE_PROGRAM.config.earn, minOrderVnd: 1_000_000 } },
            },
        })
        expect(await run(recordPurchaseAction, { ...input, ref: "sale-16" }, strict)).toEqual({
            ok: true,
            data: { status: "no_points", points: 0 },
        })
    })

    it("refuses a phone that is not a phone", async () => {
        expect(await run(recordPurchaseAction, { phone: "12", amountVnd: 1, ref: "x" })).toMatchObject({
            message: { key: "refusal_phone_invalid" },
        })
    })

    it("runs on a programme that was never saved, with the starter rules", async () => {
        const state = sampleState({ program: null })
        expect(
            await run(recordPurchaseAction, { phone: "84901112233", amountVnd: 10_000, ref: "sale-17" }, state, null),
        ).toMatchObject({ data: { status: "done", points: 10 } })
        expect(state.entries.at(-1)?.by).toBe("NIVO")
    })
})
