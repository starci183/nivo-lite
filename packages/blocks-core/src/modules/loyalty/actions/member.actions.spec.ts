import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import type { MemoryWorld } from "../../accounting/fixtures/accounting.memory"
import { entityApi, rowsOf } from "../../accounting/fixtures/accounting.memory"
import { REWARD_VOUCHER, SAMPLE_NOW, SAMPLE_PROGRAM } from "../fixtures/loyalty.data"
import {
    entriesIn,
    loyaltyProvider,
    memberIn,
    putReward,
    rewardsIn,
    sampleWorld,
    withEntity,
} from "../fixtures/loyalty.memory"
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
    world: MemoryWorld = sampleWorld(),
    memberId: string | null = "staff-1",
    provider: PortProvider = loyaltyProvider(world),
): Promise<ActionResult> => {
    expect(action.execute).toBeDefined()
    return (action.execute ?? notRunnable)(provider, raw, contextOf(memberId))
}

const pointsOf = (world: MemoryWorld, id: string): number | undefined => memberIn(world, id)?.points

const lastEntry = (world: MemoryWorld): ReturnType<typeof entriesIn>[number] | undefined => entriesIn(world).at(-1)

describe("loyalty.adjust-points", () => {
    it("adds points with the reason and the person who corrected on the ledger", async () => {
        const world = sampleWorld()
        expect(
            await run(adjustPointsAction, { id: "m-3", points: 25.4, reason: "  Goodwill  ", token: "t1" }, world),
        ).toEqual({
            ok: true,
            data: { posted: true },
        })
        expect(pointsOf(world, "m-3")).toBe(205)
        expect(lastEntry(world)).toMatchObject({
            kind: "adjust",
            points: 25,
            by: "staff-1",
            evidence: "Goodwill",
            customerId: "m-3",
        })
        expect(rowsOf(world, "loyalty.ledger-entry").at(-1)?.data["ref"]).toBe("adjust:t1")
    })

    it("adjusts once for one token, and the agent signs as NIVO", async () => {
        const world = sampleWorld()
        const input = { id: "m-3", points: -10, reason: "Refund", token: "t2" }
        await run(adjustPointsAction, input, world, null)
        expect(await run(adjustPointsAction, input, world, null)).toEqual({ ok: true, data: { posted: false } })
        expect(pointsOf(world, "m-3")).toBe(170)
        expect(lastEntry(world)?.by).toBe("NIVO")
    })

    it("keys an adjustment without a token by the member and the instant", async () => {
        const world = sampleWorld()
        await run(adjustPointsAction, { id: "m-3", points: 5, reason: "Gift" }, world)
        expect(rowsOf(world, "loyalty.ledger-entry").at(-1)?.data["ref"]).toBe(`adjust:m-3:${SAMPLE_NOW}`)
    })

    it("keeps the balance right when another write got in between, and gives up on a member who keeps changing", async () => {
        const world = sampleWorld()
        let stale = 1
        const racing = withEntity(world, "loyalty.member", {
            update: (key, expected, values) => {
                if (stale <= 0) return entityApi(world, "loyalty.member").update(key, expected, values)
                stale -= 1
                return Promise.resolve({ ok: false, reason: "stale" })
            },
        })
        await run(adjustPointsAction, { id: "m-3", points: 5, reason: "Gift", token: "t7" }, world, "s", racing)
        expect(pointsOf(world, "m-3")).toBe(185)
        const always = withEntity(world, "loyalty.member", {
            update: () => Promise.resolve({ ok: false, reason: "stale" }),
        })
        await run(adjustPointsAction, { id: "m-3", points: 5, reason: "Gift", token: "t8" }, world, "s", always)
        expect(pointsOf(world, "m-3")).toBe(185)
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
        const world = sampleWorld()
        expect(
            await run(updateMemberAction, { id: "m-3", name: " Le Chau ", birthday: "1995-04-05", note: "VIP" }, world),
        ).toEqual({ ok: true, data: { id: "m-3" } })
        expect(memberIn(world, "m-3")).toMatchObject({
            name: "Le Chau",
            birthday: "1995-04-05",
            note: "VIP",
            version: "2",
        })
    })

    it("clears the birthday with an empty value or null, and keeps the note when none is sent", async () => {
        const world = sampleWorld()
        await run(updateMemberAction, { id: "m-1", name: "Lan", birthday: "" }, world)
        expect(memberIn(world, "m-1")).toMatchObject({ birthday: null, note: "Prefers oat milk" })
        await run(updateMemberAction, { id: "m-3", name: "Chau", birthday: null }, world)
        expect(memberIn(world, "m-3")?.birthday).toBeNull()
        await run(updateMemberAction, { id: "m-5", name: "Nam" }, world)
        expect(memberIn(world, "m-5")?.birthday).toBeNull()
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
        const world = sampleWorld()
        const stale = withEntity(world, "loyalty.member", {
            update: () => Promise.resolve({ ok: false, reason: "stale" }),
        })
        expect(await run(updateMemberAction, { id: "m-3", name: "x" }, world, "staff-1", stale)).toMatchObject({
            ok: false,
            reason: "conflict",
        })
        const gone = withEntity(world, "loyalty.member", {
            update: () => Promise.resolve({ ok: false, reason: "missing" }),
        })
        expect(await run(updateMemberAction, { id: "m-3", name: "x" }, world, "staff-1", gone)).toMatchObject({
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
        const world = sampleWorld()
        const result = await run(redeemRewardAction, { id: "m-1/r-1", token: "t1" }, world)
        expect(result).toEqual({ ok: true, data: { code: "QT-DEEMT1", posted: true } })
        expect(pointsOf(world, "m-1")).toBe(950)
        expect(lastEntry(world)).toMatchObject({
            kind: "redeem",
            points: -500,
            evidence: "50,000 VND voucher QT-DEEMT1",
        })
        expect(rowsOf(world, "loyalty.ledger-entry").at(-1)?.data).toMatchObject({
            rewardId: "r-1",
            ref: "redeem:t1",
        })
    })

    it("redeems once for one token, and the agent signs as NIVO", async () => {
        const world = sampleWorld()
        await run(redeemRewardAction, { id: "m-1/r-1", token: "t2" }, world, null)
        expect(await run(redeemRewardAction, { id: "m-1/r-1", token: "t2" }, world, null)).toEqual({
            ok: true,
            data: { code: "QT-DEEMT2", posted: false },
        })
        expect(pointsOf(world, "m-1")).toBe(950)
        expect(lastEntry(world)?.by).toBe("NIVO")
    })

    it("keys a redemption without a token by the offer and the instant", async () => {
        const world = sampleWorld()
        await run(redeemRewardAction, { id: "m-1/r-1" }, world)
        expect(rowsOf(world, "loyalty.ledger-entry").at(-1)?.data["ref"]).toBe(`redeem:m-1/r-1:${SAMPLE_NOW}`)
    })

    it("takes one from the stock of a reward that has stock", async () => {
        const world = sampleWorld()
        rowsOf(world, "loyalty.reward").splice(0, 1)
        putReward(world, { ...REWARD_VOUCHER, stock: 2 })
        await run(redeemRewardAction, { id: "m-1/r-1", token: "t3" }, world)
        expect(rewardsIn(world).find((reward) => reward.id === "r-1")?.stock).toBe(1)
    })

    it("does not touch the stock when the ledger already had the entry", async () => {
        const world = sampleWorld()
        rowsOf(world, "loyalty.reward").splice(0, 1)
        putReward(world, { ...REWARD_VOUCHER, stock: 2 })
        const lost = withEntity(world, "loyalty.ledger-entry", {
            list: () => Promise.resolve({ rows: [], next: null }),
            insert: () => Promise.resolve({ ok: false, reason: "taken", constraint: "ref_key", refusal: "taken" }),
        })
        expect(await run(redeemRewardAction, { id: "m-1/r-1", token: "t4" }, world, "staff-1", lost)).toMatchObject({
            ok: true,
            data: { posted: false },
        })
        expect(pointsOf(world, "m-1")).toBe(1450)
        expect(rewardsIn(world).find((reward) => reward.id === "r-1")?.stock).toBe(2)
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
        const world = sampleWorld()
        expect(await run(redeemRewardAction, { id: "m-4/r-1" }, world)).toMatchObject({
            message: { key: "refusal_not_redeemable_not_enough_points" },
        })
        expect(await run(redeemRewardAction, { id: "m-1/r-3" }, world)).toMatchObject({
            message: { key: "refusal_not_redeemable_inactive" },
        })
        expect(pointsOf(world, "m-1")).toBe(1450)
    })
})

describe("loyalty.record-purchase", () => {
    it("earns the points of a sale for a new phone and creates the customer", async () => {
        const world = sampleWorld()
        const result = await run(
            recordPurchaseAction,
            { phone: "0922 111 000", name: "  Bui An  ", amountVnd: 200_000, items: "coffee", ref: "sale-9" },
            world,
        )
        expect(result).toEqual({ ok: true, data: { status: "done", points: 200 } })
        const created = rowsOf(world, "loyalty.member").at(-1)
        expect(created).toBeDefined()
        expect(memberIn(world, created?.id ?? "")).toMatchObject({
            name: "Bui An",
            phone: "84922111000",
            points: 200,
            tierKey: "dong",
        })
        expect(created?.data).toMatchObject({ contact: "84922111000", tier: "\u0110\u1ed3ng", activity: "active" })
        expect(lastEntry(world)).toMatchObject({
            kind: "earn",
            points: 200,
            amountVnd: 200_000,
            evidence: "1/1k",
            expiresAt: "2027-11-05T05:00:00.000Z",
        })
    })

    it("names the customer after the phone when no name is given", async () => {
        const world = sampleWorld()
        await run(recordPurchaseAction, { phone: "0922111000", amountVnd: 50_000, ref: "sale-10" }, world)
        expect(rowsOf(world, "loyalty.member").at(-1)?.data["name"]).toBe("84922111000")
    })

    it("lifts the customer to the tier the lifetime spend reaches", async () => {
        const world = sampleWorld()
        const result = await run(
            recordPurchaseAction,
            { phone: "84901112233", amountVnd: 3_000_000, ref: "sale-11" },
            world,
        )
        expect(result).toEqual({ ok: true, data: { status: "done", points: 3000 } })
        expect(memberIn(world, "m-3")).toMatchObject({ tierKey: "bac" })
        expect(rowsOf(world, "loyalty.member").find((row) => row.id === "m-3")?.data["tier"]).toBe("B\u1ea1c")
    })

    it("leaves a customer at the top tier where they are", async () => {
        const world = sampleWorld()
        await run(recordPurchaseAction, { phone: "84912345678", amountVnd: 100_000, ref: "sale-12" }, world)
        expect(memberIn(world, "m-1")).toMatchObject({ tierKey: "vang", version: "2" })
    })

    it("lifts nobody in a programme without tiers, or when the customer cannot be read again", async () => {
        const bare = sampleWorld({ ...SAMPLE_PROGRAM, config: { ...SAMPLE_PROGRAM.config, tiers: [] } })
        expect(
            await run(recordPurchaseAction, { phone: "84901112233", amountVnd: 100_000, ref: "sale-13" }, bare),
        ).toMatchObject({ data: { status: "done" } })
        expect(memberIn(bare, "m-3")?.tierKey).toBe("dong")
        const world = sampleWorld()
        let reads = 0
        const unreadable = withEntity(world, "loyalty.member", {
            get: (id) => {
                reads += 1
                return Promise.resolve(
                    reads > 1 ? null : (rowsOf(world, "loyalty.member").find((row) => row.id === id) ?? null),
                )
            },
        })
        expect(
            await run(
                recordPurchaseAction,
                { phone: "84901112233", amountVnd: 3_000_000, ref: "sale-14" },
                world,
                "s",
                unreadable,
            ),
        ).toMatchObject({ data: { status: "done" } })
    })

    it("earns once for one ref, and nothing below the smallest order", async () => {
        const world = sampleWorld()
        const input = { phone: "84901112233", amountVnd: 100_000, ref: "sale-15" }
        await run(recordPurchaseAction, input, world)
        expect(await run(recordPurchaseAction, input, world)).toEqual({
            ok: true,
            data: { status: "duplicate", points: 0 },
        })
        const strict = sampleWorld({
            ...SAMPLE_PROGRAM,
            config: { ...SAMPLE_PROGRAM.config, earn: { ...SAMPLE_PROGRAM.config.earn, minOrderVnd: 1_000_000 } },
        })
        expect(await run(recordPurchaseAction, { ...input, ref: "sale-16" }, strict)).toEqual({
            ok: true,
            data: { status: "no_points", points: 0 },
        })
    })

    it("answers a conflict when the engine refuses to find or create the customer", async () => {
        const world = sampleWorld()
        const refused = withEntity(world, "loyalty.member", {
            ensure: () => Promise.resolve({ ok: false, reason: "invalid" }),
        })
        expect(
            await run(
                recordPurchaseAction,
                { phone: "84901112233", amountVnd: 100_000, ref: "sale-18" },
                world,
                "s",
                refused,
            ),
        ).toMatchObject({ ok: false, reason: "conflict" })
    })

    it("refuses a phone that is not a phone", async () => {
        expect(await run(recordPurchaseAction, { phone: "12", amountVnd: 1, ref: "x" })).toMatchObject({
            message: { key: "refusal_phone_invalid" },
        })
    })

    it("runs on a programme that was never saved, with the starter rules", async () => {
        const world = sampleWorld(null)
        expect(
            await run(recordPurchaseAction, { phone: "84901112233", amountVnd: 10_000, ref: "sale-17" }, world, null),
        ).toMatchObject({ data: { status: "done", points: 10 } })
        expect(lastEntry(world)?.by).toBe("NIVO")
    })
})
