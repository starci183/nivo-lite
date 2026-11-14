import type { EntityApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { entityApi, putRecord, rowsOf } from "../ledger/fixtures/accounting.memory"
import type { MemoryWorld } from "../ledger/fixtures/accounting.memory"
import { MEMBER_GOLD, REWARD_VOUCHER, SAMPLE_NOW, SAMPLE_PROGRAM } from "./fixtures/loyalty.data"
import { memberIn, putMember, putReward, rewardsIn, sampleWorld } from "./fixtures/loyalty.memory"
import {
    addMissingRewards,
    campaignsList,
    campaignsSentSince,
    decide,
    decisionsWaiting,
    programGet,
    programSave,
    rewardById,
    rewardsList,
    saveReward,
    takeOne,
} from "./loyalty-catalogue-data"
import {
    ledgerExpiryEntries,
    ledgerTimeline,
    ledgerTotalsSince,
    memberById,
    membersAll,
    postLedger,
    redeemedCounts,
    updateMember,
} from "./loyalty-member-data"

const api = (world: MemoryWorld, entity: string): EntityApi => entityApi(world, entity)

/** A record row that no declared entity of the Loyalty would read. */
const GARBAGE = { name: 1 }

const row = (data: Readonly<Record<string, unknown>>): RecordRow => ({
    id: "g1",
    workspaceId: "w1",
    version: "1",
    createdAt: SAMPLE_NOW,
    updatedAt: SAMPLE_NOW,
    data,
})

describe("the records that are not the module's", () => {
    it("are skipped by every list and read as nothing by every get", async () => {
        const world = sampleWorld()
        for (const entity of ["blocks-core.sales.loyalty-member", "blocks-core.sales.loyalty-ledger-entry", "blocks-core.sales.loyalty-reward", "blocks-core.sales.loyalty-campaign"])
            putRecord(world, entity, "g1", { ...GARBAGE, memberId: "m-1" })
        putRecord(world, "blocks-core.sales.loyalty-decision", "g1", { ...GARBAGE, status: "waiting" })
        putRecord(world, "blocks-core.sales.loyalty-program", "g1", { ...GARBAGE, scope: "workspace" })
        expect(await membersAll(api(world, "blocks-core.sales.loyalty-member"))).toHaveLength(5)
        expect(await ledgerTimeline(api(world, "blocks-core.sales.loyalty-ledger-entry"), "m-1", 10)).toHaveLength(4)
        expect(await ledgerExpiryEntries(api(world, "blocks-core.sales.loyalty-ledger-entry"), "m-1")).toHaveLength(4)
        expect(await rewardsList(api(world, "blocks-core.sales.loyalty-reward"), false)).toHaveLength(3)
        expect(await campaignsList(api(world, "blocks-core.sales.loyalty-campaign"), 10)).toHaveLength(2)
        expect(await decisionsWaiting(api(world, "blocks-core.sales.loyalty-decision"), 10)).toHaveLength(2)
        expect(await memberById(api(world, "blocks-core.sales.loyalty-member"), "g1")).toBeNull()
        expect(await rewardById(api(world, "blocks-core.sales.loyalty-reward"), "g1")).toBeNull()
        expect(await memberById(api(world, "blocks-core.sales.loyalty-member"), "nobody")).toBeNull()
        expect(await rewardById(api(world, "blocks-core.sales.loyalty-reward"), "nobody")).toBeNull()
        expect(await programGet(api(world, "blocks-core.sales.loyalty-program"))).toBeNull()
    })

    it("make a write whose answer is not a customer a conflict", async () => {
        const world = sampleWorld()
        const members = {
            ...api(world, "blocks-core.sales.loyalty-member"),
            update: () => Promise.resolve({ ok: true as const, row: row(GARBAGE), version: "2" }),
        }
        expect(await updateMember(members, "m-1", "1", { note: "x" })).toEqual({ ok: false, reason: "conflict" })
    })
})

describe("the pages of a read", () => {
    it("run on past the first page and stop at the limit", async () => {
        const world = sampleWorld()
        for (let index = 0; index < 150; index += 1)
            putMember(world, { ...MEMBER_GOLD, id: `p-${index}`, name: `Extra ${index}`, phone: null, email: null })
        expect(await membersAll(api(world, "blocks-core.sales.loyalty-member"))).toHaveLength(155)
        expect(await campaignsList(api(world, "blocks-core.sales.loyalty-campaign"), 1)).toHaveLength(1)
    })

    it("read a number the engine sent as text, and zero for one that is no number", async () => {
        const world = sampleWorld()
        const measured = (value: string | number | null): EntityApi => ({
            ...api(world, "blocks-core.sales.loyalty-campaign"),
            aggregate: () => Promise.resolve([{ groups: {}, measures: { sent: value } }]),
        })
        expect(await campaignsSentSince(measured("7"), SAMPLE_NOW)).toBe(7)
        expect(await campaignsSentSince(measured("seven"), SAMPLE_NOW)).toBe(0)
        expect(await campaignsSentSince(measured(null), SAMPLE_NOW)).toBe(0)
        expect(await campaignsSentSince(api(world, "blocks-core.sales.loyalty-campaign"), "2026-10-01T00:00:00.000Z")).toBe(1)
    })
})

describe("the ledger", () => {
    it("posts nothing for a customer who is gone, and counts an earning without an amount as no spend", async () => {
        const world = sampleWorld()
        const members = api(world, "blocks-core.sales.loyalty-member")
        const ledger = api(world, "blocks-core.sales.loyalty-ledger-entry")
        const entry = {
            customerId: "m-3",
            kind: "earn" as const,
            points: 5,
            ref: "r-x",
            by: "NIVO",
            amountVnd: null,
            rewardId: null,
            evidence: null,
            expiresAt: null,
            occurredAt: SAMPLE_NOW,
        }
        expect(await postLedger(members, ledger, { ...entry, customerId: "nobody" })).toBeNull()
        expect(await postLedger(members, ledger, entry)).toEqual(expect.any(String))
        expect(memberIn(world, "m-3")).toMatchObject({ points: 185, lifetimeSpendVnd: 950_000, visits: 5 })
    })

    it("skips the group of a redemption that names no reward", async () => {
        const world = sampleWorld()
        const ledger: EntityApi = {
            ...api(world, "blocks-core.sales.loyalty-ledger-entry"),
            aggregate: () =>
                Promise.resolve([
                    { groups: { rewardId: null }, measures: { redeemed: 1 } },
                    { groups: { rewardId: "r-1" }, measures: { redeemed: 2 } },
                ]),
        }
        expect(await redeemedCounts(ledger, "m-1")).toEqual({ "r-1": 2 })
        expect(await redeemedCounts(api(world, "blocks-core.sales.loyalty-ledger-entry"), "m-1")).toEqual({ "r-1": 1 })
    })

    it("lists every kind in the totals, those that moved nothing at zero", async () => {
        const world = sampleWorld()
        expect(await ledgerTotalsSince(api(world, "blocks-core.sales.loyalty-ledger-entry"), "2026-11-01T00:00:00.000Z")).toEqual([
            { kind: "earn", entries: 1, points: 1800, amountVnd: 1_200_000 },
            { kind: "redeem", entries: 0, points: 0, amountVnd: 0 },
            { kind: "expire", entries: 0, points: 0, amountVnd: 0 },
            { kind: "adjust", entries: 1, points: -170, amountVnd: 0 },
        ])
    })
})

describe("the rewards", () => {
    it("derive the key from the name when the edit gives none", async () => {
        const world = sampleWorld()
        const edit = {
            name: "Gift Card",
            kind: "voucher" as const,
            valueVnd: 1,
            percent: null,
            pointsCost: 1,
            stock: null,
            perCustomerLimit: null,
            minTierKey: null,
            note: "",
            active: true,
        }
        expect(await saveReward(api(world, "blocks-core.sales.loyalty-reward"), edit)).toMatchObject({
            ok: true,
            row: { key: "gift-card" },
        })
        expect(await addMissingRewards(api(world, "blocks-core.sales.loyalty-reward"), [edit])).toBe(0)
        expect(await addMissingRewards(api(world, "blocks-core.sales.loyalty-reward"), [{ ...edit, name: "Other" }])).toBe(1)
        expect(rewardsIn(world).map((reward) => reward.key)).toContain("other")
    })

    it("take one from the stock, read the reward again when another write got in first, and leave an unlimited one alone", async () => {
        const world = sampleWorld()
        rowsOf(world, "blocks-core.sales.loyalty-reward").splice(0)
        putReward(world, { ...REWARD_VOUCHER, stock: 5 })
        let stale = 1
        const rewards: EntityApi = {
            ...api(world, "blocks-core.sales.loyalty-reward"),
            update: (key, expected, values) => {
                if (stale <= 0) return api(world, "blocks-core.sales.loyalty-reward").update(key, expected, values)
                stale -= 1
                return Promise.resolve({ ok: false, reason: "stale" })
            },
        }
        await takeOne(rewards, "r-1")
        expect(rewardsIn(world)[0]?.stock).toBe(4)
        const always: EntityApi = {
            ...api(world, "blocks-core.sales.loyalty-reward"),
            update: () => Promise.resolve({ ok: false, reason: "stale" }),
        }
        await takeOne(always, "r-1")
        expect(rewardsIn(world)[0]?.stock).toBe(4)
        await takeOne(api(world, "blocks-core.sales.loyalty-reward"), "nobody")
        rowsOf(world, "blocks-core.sales.loyalty-reward").splice(0)
        putReward(world, REWARD_VOUCHER)
        await takeOne(api(world, "blocks-core.sales.loyalty-reward"), "r-1")
        expect(rewardsIn(world)[0]?.stock).toBeNull()
    })
})

describe("the programme", () => {
    it("is read back as saved and is written once", async () => {
        const world = sampleWorld(null)
        const program = api(world, "blocks-core.sales.loyalty-program")
        expect(await programGet(program)).toBeNull()
        const saved = await programSave(program, {
            name: "P",
            slug: "p",
            enabled: true,
            config: SAMPLE_PROGRAM.config,
        })
        expect(saved).toMatchObject({ name: "P", version: "1" })
        expect(await programGet(program)).toMatchObject({ name: "P", slug: "p" })
    })
})

describe("the decisions", () => {
    it("are decided once, and a decision without a status is missing", async () => {
        const world = sampleWorld()
        const decisions = api(world, "blocks-core.sales.loyalty-decision")
        expect(await decide(decisions, "d-1", "approved")).toMatchObject({ ok: true })
        expect(await decide(decisions, "d-1", "approved")).toEqual({ ok: false, reason: "missing" })
        putRecord(world, "blocks-core.sales.loyalty-decision", "g2", GARBAGE)
        expect(await decide(decisions, "g2", "approved")).toEqual({ ok: false, reason: "missing" })
    })
})
