import type { ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { MEMBER_GOLD, sampleState, SAMPLE_NOW, SAMPLE_PROGRAM } from "../fixtures/loyalty.data"
import type { DecisionItem } from "../loyalty.types"
import { memoryProvider } from "../memory"
import type { MemoryState, StoredEntry } from "../memory"
import { figuresRead, statsRead, tiersRead } from "./board.read"
import {
    memberCountsRead,
    memberLedgerRead,
    memberRead,
    memberRewardsRead,
    membersRead,
    withKnownTiers,
    tierCountsRead,
} from "./members.read"
import { pendingCountRead, pendingRead, pendingWaitingRead } from "./pending.read"
import { campaignsRead, programRead } from "./program.read"
import { rewardRead, rewardsRead } from "./rewards.read"

const context: RunContext = {
    workspaceId: "w1",
    memberId: "owner-1",
    now: new Date(SAMPLE_NOW),
    timeZone: "Asia/Ho_Chi_Minh",
}

/** Sixty points of the third member that expire within the warning window. */
const expiringEntry: StoredEntry = {
    id: "e-9",
    customerId: "m-3",
    kind: "earn",
    points: 60,
    amountVnd: 60_000,
    evidence: null,
    by: "NIVO",
    expiresAt: "2026-11-20T00:00:00.000Z",
    occurredAt: "2026-05-20T00:00:00.000Z",
    ref: "sale-9",
    rewardId: null,
}

const decisionOf = (patch: Partial<DecisionItem>): DecisionItem => ({
    id: "x",
    action: "send_promo",
    summary: "s",
    draft: "",
    reason: null,
    amountVnd: null,
    createdAt: SAMPLE_NOW,
    customer: "",
    ...patch,
})

/** What running stands in for a read that does not run in the package, which the expectation before it already failed. */
const notRunnable = (): Promise<ReadRunResult> => Promise.resolve({ ok: false, problems: [] })

/** The data a read answers, or the problems of the variables it was refused with. */
const run = async (
    read: ReadDefinition,
    raw: unknown,
    state: MemoryState = sampleState(),
    provider: PortProvider = memoryProvider(state),
): Promise<unknown> => {
    expect(read.execute).toBeDefined()
    const result = await (read.execute ?? notRunnable)(provider, raw, context)
    return result.ok ? result.data : { refused: result.problems }
}

describe("loyalty.figures and loyalty.stats", () => {
    it("works the ribbon out from the same members the statistics use", async () => {
        expect(await run(figuresRead, {})).toEqual({
            members: 5,
            activeMembers: 2,
            pointsIssued30d: 1800,
            redemptions30d: 1,
            pointsRedeemed30d: 500,
            atRisk: 2,
        })
    })

    it("adds up what the ledger moved in the last 30 days and the promotions sent", async () => {
        const stats = await run(statsRead, {})
        expect(stats).toMatchObject({ members: 5, pointsOutstanding: 2290, promosSent30d: 1, birthdaysThisMonth: 1 })
        expect(stats).toMatchObject({
            tierCounts: [
                { key: "dong", count: 2 },
                { key: "bac", count: 1 },
                { key: "vang", count: 1 },
            ],
        })
    })

    it("refuses a variable it does not declare", async () => {
        expect(await run(figuresRead, { other: 1 })).toEqual({ refused: [{ code: "INPUT_UNKNOWN_KEY", at: "other" }] })
    })
})

describe("loyalty.tiers", () => {
    it("lists the ladder with the members who hold each tier", async () => {
        expect(await run(tiersRead, {})).toEqual({
            rows: [
                { key: "dong", name: "\u0110\u1ed3ng", minSpendVnd: 0, multiplier: 1, benefit: "", count: 2 },
                { key: "bac", name: "B\u1ea1c", minSpendVnd: 3_000_000, multiplier: 1.2, benefit: "", count: 1 },
                { key: "vang", name: "V\u00e0ng", minSpendVnd: 10_000_000, multiplier: 1.5, benefit: "", count: 1 },
            ],
        })
    })

    it("lists the starter ladder before the programme is saved", async () => {
        const result = await run(tiersRead, {}, sampleState({ program: null }))
        expect(result).toMatchObject({ rows: [{ key: "dong" }, { key: "bac" }, { key: "vang" }] })
    })
})

describe("loyalty.members and loyalty.member-counts", () => {
    it("lists the members newest purchase first with the tier by name and the activity", async () => {
        const page = await run(membersRead, {})
        expect(page).toMatchObject({
            cursor: null,
            rows: [
                { id: "m-1", tier: "V\u00e0ng", contact: "84912345678", activity: "active" },
                { id: "m-3", tier: "\u0110\u1ed3ng", activity: "active" },
                { id: "m-2", tier: "B\u1ea1c", activity: "at_risk" },
                { id: "m-5", tier: "\u0110\u1ed3ng", activity: "at_risk" },
                { id: "m-4", tier: "", contact: "ha@example.com", activity: "new" },
            ],
        })
    })

    it("searches the name and the contact without caring for accents or case", async () => {
        expect(await run(membersRead, { q: "LAN" })).toMatchObject({ rows: [{ id: "m-1" }] })
        expect(await run(membersRead, { q: "ha@example" })).toMatchObject({ rows: [{ id: "m-4" }] })
    })

    it("narrows by activity and sorts by points, spend or name", async () => {
        expect(await run(membersRead, { activity: "at_risk", sort: "points" })).toMatchObject({
            rows: [{ id: "m-2" }, { id: "m-5" }],
        })
        expect(await run(membersRead, { activity: "all", sort: "name" })).toMatchObject({
            rows: [{ id: "m-3" }, { id: "m-1" }, { id: "m-4" }, { id: "m-2" }, { id: "m-5" }],
        })
        expect(await run(membersRead, { sort: "spend" })).toMatchObject({
            rows: [{ id: "m-1" }, { id: "m-2" }, { id: "m-3" }, { id: "m-5" }, { id: "m-4" }],
        })
    })

    it("keeps members that tie on every sort key in the order they have, and writes a member with no contact as empty", async () => {
        const state = sampleState()
        state.members.splice(
            0,
            state.members.length,
            { ...MEMBER_GOLD, id: "a", phone: null, email: null },
            { ...MEMBER_GOLD, id: "b" },
        )
        expect(await run(membersRead, { sort: "name" }, state)).toMatchObject({
            rows: [
                { id: "a", contact: "" },
                { id: "b", contact: "84912345678" },
            ],
        })
    })

    it("names the tiers from the starter rules before the programme is saved", async () => {
        expect(await run(membersRead, { q: "lan" }, sampleState({ program: null }))).toMatchObject({
            rows: [{ id: "m-1", tier: "V\u00e0ng" }],
        })
    })

    it("pages by a cursor", async () => {
        const state = sampleState()
        for (let index = 0; index < 30; index += 1)
            state.members.push({ ...MEMBER_GOLD, id: `p-${index}`, name: `Extra ${index}` })
        const first = await run(membersRead, { sort: "name" }, state)
        expect(first).toMatchObject({ cursor: "30" })
        expect(await run(membersRead, { sort: "name", cursor: "30" }, state)).toMatchObject({ cursor: null })
    })

    it("counts the members of each activity under the same search", async () => {
        expect(await run(memberCountsRead, {})).toEqual({ counts: { active: 2, at_risk: 2, new: 1 }, total: 5 })
        expect(await run(memberCountsRead, { q: "tran" })).toEqual({
            counts: { active: 0, at_risk: 1, new: 0 },
            total: 1,
        })
    })
})

describe("the tier filter of loyalty.members and loyalty.tier-counts", () => {
    it("narrows the members to one tier of the starter ladder", async () => {
        expect(await run(membersRead, { tier: "dong", sort: "name" })).toMatchObject({
            rows: [{ id: "m-3" }, { id: "m-5" }],
        })
    })

    it("takes any tier of the ladder the workspace saved, a renamed one included", async () => {
        const state = sampleState()
        state.program = {
            ...SAMPLE_PROGRAM,
            config: {
                ...SAMPLE_PROGRAM.config,
                tiers: SAMPLE_PROGRAM.config.tiers.map((tier) => ({ ...tier, key: `${tier.key}-2` })),
            },
        }
        expect(await run(membersRead, { tier: "dong-2" }, state)).toEqual({ rows: [], cursor: null })
        expect(await run(membersRead, { tier: "dong" }, state)).toEqual({
            refused: [{ code: "INPUT_INVALID", at: "tier" }],
        })
    })

    it("refuses variables that are no object without asking for a tier", async () => {
        expect(await run(membersRead, null)).toEqual({ refused: [{ code: "INPUT_INVALID", at: "." }] })
    })

    it("refuses when the list underneath cannot run", async () => {
        const bare = withKnownTiers({ ...membersRead, execute: undefined })
        expect(await run(bare, {})).toEqual({ refused: [{ code: "INPUT_INVALID", at: "." }] })
    })

    it("refuses a tier the list does not know", async () => {
        expect(await run(membersRead, { tier: "platinum" })).toEqual({
            refused: [{ code: "INPUT_INVALID", at: "tier" }],
        })
    })

    it("counts the members of each tier under the same search", async () => {
        expect(await run(tierCountsRead, {})).toMatchObject({ counts: { dong: 2, bac: 1, vang: 1 }, total: 4 })
        expect(tierCountsRead.listing).toEqual({ kind: "counts", of: "loyalty.members", by: "tier" })
    })
})

describe("loyalty.member", () => {
    it("answers one member with the tier progress", async () => {
        expect(await run(memberRead, { id: "m-1" })).toMatchObject({
            id: "m-1",
            name: "Nguy\u1ec5n Th\u1ecb Lan",
            tier: "V\u00e0ng",
            points: 1450,
            nextTier: "",
            missingVnd: 0,
            birthday: "1990-11-20",
        })
        expect(await run(memberRead, { id: "m-3" })).toMatchObject({ nextTier: "B\u1ea1c", missingVnd: 2_050_000 })
    })

    it("tells the points that expire in the warning window and when", async () => {
        const state = sampleState()
        state.entries.push(expiringEntry)
        expect(await run(memberRead, { id: "m-3" }, state)).toMatchObject({
            expiringPoints: 60,
            expiringAt: "2026-11-20T00:00:00.000Z",
        })
    })

    it("sees no expiry in a programme whose points never expire", async () => {
        const never = { ...SAMPLE_PROGRAM, config: { ...SAMPLE_PROGRAM.config, expiry: { months: 0, warnDays: 30 } } }
        const state = sampleState({ program: never })
        state.entries.push(expiringEntry)
        expect(await run(memberRead, { id: "m-3" }, state)).toMatchObject({ expiringPoints: 0, expiringAt: "" })
    })

    it("writes what a member lacks as empty", async () => {
        expect(await run(memberRead, { id: "m-4" })).toMatchObject({
            phone: "",
            email: "ha@example.com",
            birthday: "",
            lastVisitAt: "",
            tier: "",
            nextTier: "B\u1ea1c",
        })
        expect(await run(memberRead, { id: "m-2" })).toMatchObject({ email: "" })
    })

    it("answers null for a member the workspace does not have", async () => {
        expect(await run(memberRead, { id: "nobody" })).toBeNull()
    })
})

describe("loyalty.member-rewards", () => {
    it("lists the rewards the member can redeem now, each under the id the redeem action takes", async () => {
        expect(await run(memberRewardsRead, { id: "m-1" })).toEqual({
            rows: [
                { id: "m-1/r-2", name: "10% off", pointsCost: 800, valueVnd: 100_000 },
                { id: "m-1/r-1", name: "50,000 VND voucher", pointsCost: 500, valueVnd: 50_000 },
            ],
        })
    })

    it("leaves out what the member cannot redeem and lists nothing for a member the workspace lacks", async () => {
        expect(await run(memberRewardsRead, { id: "m-4" })).toEqual({ rows: [] })
        expect(await run(memberRewardsRead, { id: "nobody" })).toEqual({ rows: [] })
    })
})

describe("loyalty.member-ledger", () => {
    it("lists the newest entries first as the table draws them", async () => {
        const result = await run(memberLedgerRead, { id: "m-1" })
        expect(result).toMatchObject({
            rows: [{ id: "e-4", kind: "adjust", amountVnd: null }, { id: "e-3" }, { id: "e-2" }, { id: "e-1" }],
        })
    })

    it("writes a missing note as empty", async () => {
        const state = sampleState()
        state.entries.push(expiringEntry)
        expect(await run(memberLedgerRead, { id: "m-3" }, state)).toMatchObject({ rows: [{ id: "e-9", evidence: "" }] })
    })
})

describe("loyalty.rewards and loyalty.reward", () => {
    it("lists the whole catalogue with paused rewards", async () => {
        expect(await run(rewardsRead, {})).toMatchObject({
            rows: [
                { id: "r-3", state: "paused", active: false, minTierKey: "bac" },
                { id: "r-2", state: "active", percent: 10 },
                { id: "r-1", state: "active", minTierKey: "" },
            ],
        })
    })

    it("answers one reward, or null for a reward the workspace lacks", async () => {
        expect(await run(rewardRead, { id: "r-2" })).toMatchObject({ id: "r-2", name: "10% off", perCustomerLimit: 2 })
        expect(await run(rewardRead, { id: "nobody" })).toBeNull()
    })
})

describe("loyalty.program and loyalty.campaigns", () => {
    it("answers the programme with its rules flat and the path of its public page", async () => {
        expect(await run(programRead, {})).toMatchObject({
            name: "Hoa Mai Coffee",
            enabled: true,
            publicPath: "/l/hoa-mai-coffee",
            perThousandVnd: 1,
            trigger: "payment",
            expiryMonths: 12,
            birthdayOn: true,
            hourFrom: "08:00",
        })
    })

    it("answers the starter rules, switched off, before the first save", async () => {
        expect(await run(programRead, {}, sampleState({ program: null }))).toMatchObject({
            name: "",
            enabled: false,
            slug: "",
            publicPath: "",
            batch: 20,
        })
    })

    it("lists the newest promotions first", async () => {
        expect(await run(campaignsRead, {})).toMatchObject({
            rows: [
                { id: "c-2", status: "done", sent: 1 },
                { id: "c-1", status: "waiting_decision", recipients: 1 },
            ],
        })
    })
})

describe("loyalty.pending", () => {
    it("queues the waiting decisions with the age of each and the commands to answer them", async () => {
        expect(await run(pendingRead, {})).toMatchObject({
            count: "2",
            more: null,
            rows: [
                {
                    id: "d-1",
                    title: "G\u1eedi khuy\u1ebfn m\u00e3i cho th\u00e0nh vi\u00ean h\u1ea1ng B\u1ea1c l\u00e2u ch\u01b0a quay l\u1ea1i",
                    badges: [{ label: "1d" }],
                    primary: { id: "approve" },
                    menu: [{ id: "reject", isDanger: true }],
                },
                {
                    id: "d-2",
                    badges: [{ label: "5h" }],
                    proposal: "C\u1ed9ng 200 \u0111i\u1ec3m cho l\u1ea7n mua ch\u01b0a \u0111\u01b0\u1ee3c t\u00edch",
                },
            ],
        })
    })

    it("counts in minutes for a decision raised a moment ago and leaves out what is not about loyalty", async () => {
        const state = sampleState()
        state.decisions.push(
            decisionOf({ id: "d-3", action: "award_points", amountVnd: 90_000 }),
            decisionOf({ id: "d-4", action: "order_confirm" }),
        )
        expect(await run(pendingRead, {}, state)).toMatchObject({
            count: "3",
            rows: [{ id: "d-1" }, { id: "d-2" }, { id: "d-3", amount: "90000", badges: [{ label: "0m" }] }],
        })
        expect(await run(pendingCountRead, {}, state)).toEqual({ count: 3 })
    })

    it("has no count when nothing waits", async () => {
        expect(await run(pendingRead, {}, sampleState({ decisions: [] }))).toEqual({
            count: null,
            more: null,
            rows: [],
        })
        expect(await run(pendingCountRead, {}, sampleState({ decisions: [] }))).toEqual({ count: 0 })
    })

    it("proposes the draft of a promotion in place of its summary", async () => {
        const state = sampleState({
            decisions: [decisionOf({ id: "d-5", summary: "Promote", draft: "Hello {ten_khach}" })],
        })
        expect(await run(pendingRead, {}, state)).toMatchObject({ rows: [{ proposal: "Hello {ten_khach}" }] })
    })
})

describe("loyalty.pending-waiting", () => {
    it("lists the first decisions that wait for the owner, each linking to the pending view", async () => {
        expect(await run(pendingWaitingRead, {})).toEqual({
            count: "2",
            rows: [
                {
                    id: "d-1",
                    title: "G\u1eedi khuy\u1ebfn m\u00e3i cho th\u00e0nh vi\u00ean h\u1ea1ng B\u1ea1c l\u00e2u ch\u01b0a quay l\u1ea1i",
                    description: "1 member",
                    href: "?tab=pending",
                },
                {
                    id: "d-2",
                    title: "C\u1ed9ng 200 \u0111i\u1ec3m cho l\u1ea7n mua ch\u01b0a \u0111\u01b0\u1ee3c t\u00edch",
                    description: "Nguy\u1ec5n Th\u1ecb Lan",
                    href: "?tab=pending",
                },
            ],
            linkLabel: "",
            linkHref: "",
            more: null,
        })
    })

    it("says how many more wait than the region shows, and nothing when none waits", async () => {
        const many = Array.from({ length: 7 }, (_, index) => decisionOf({ id: `x-${index}` }))
        expect(await run(pendingWaitingRead, {}, sampleState({ decisions: many }))).toMatchObject({
            count: "7",
            more: "2",
        })
        expect(await run(pendingWaitingRead, {}, sampleState({ decisions: [] }))).toMatchObject({
            count: null,
            rows: [],
        })
    })
})
