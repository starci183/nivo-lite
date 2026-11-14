import { DEFAULT_CONFIG } from "./config"
import type { LedgerTotal, LoyaltyMember } from "./ledger.types"
import { activityOf, computeFigures, computeStats, monthOf } from "./stats"

const DAY = 86_400_000
const NOW = Date.UTC(2026, 10, 5, 5)
const VN = "Asia/Ho_Chi_Minh"
const ago = (days: number): string => new Date(NOW - days * DAY).toISOString()

const member = (patch: Partial<LoyaltyMember>): LoyaltyMember => ({
    id: "m",
    tierKey: "dong",
    points: 100,
    lifetimeSpendVnd: 1_000_000,
    lastVisitAt: ago(10),
    joinedAt: ago(200),
    birthday: null,
    ...patch,
})

const MEMBERS: ReadonlyArray<LoyaltyMember> = [
    member({ id: "a", lastVisitAt: ago(5), birthday: "1990-11-20" }),
    member({ id: "b", tierKey: "bac", points: 50, lastVisitAt: ago(80), birthday: "1991-01-02" }),
    member({ id: "c", tierKey: null, points: 0, lastVisitAt: null, joinedAt: ago(10) }),
    member({ id: "d", tierKey: null, points: 0, lastVisitAt: null, joinedAt: ago(300) }),
    member({ id: "e", points: 25, lastVisitAt: ago(120) }),
]

const TOTALS: ReadonlyArray<LedgerTotal> = [
    { kind: "earn", entries: 3, points: 900, amountVnd: 900_000 },
    { kind: "earn", entries: 1, points: 100, amountVnd: 100_000 },
    { kind: "redeem", entries: 2, points: -500, amountVnd: 100_000 },
    { kind: "adjust", entries: 1, points: 10, amountVnd: 0 },
]

describe("monthOf", () => {
    it("reads the month in the workspace's time zone", () => {
        expect(monthOf(Date.UTC(2026, 9, 31, 20), "Asia/Ho_Chi_Minh")).toBe(11)
        expect(monthOf(Date.UTC(2026, 9, 31, 10), "Asia/Ho_Chi_Minh")).toBe(10)
    })

    it("a workspace in another zone reads another month at the same instant", () => {
        expect(monthOf(Date.UTC(2026, 9, 31, 20), "Europe/Berlin")).toBe(10)
        expect(monthOf(Date.UTC(2026, 10, 1, 2), "America/New_York")).toBe(10)
    })
})

describe("computeStats", () => {
    const stats = computeStats(MEMBERS, TOTALS, DEFAULT_CONFIG.tiers, 4, NOW, VN)

    it("counts the members, the active ones in 90 days and the points they hold", () => {
        expect(stats).toMatchObject({ members: 5, active90d: 2, pointsOutstanding: 175 })
    })

    it("adds up what the ledger moved by kind, with taken points as positive numbers", () => {
        expect(stats).toMatchObject({
            earned30d: 1000,
            redeemed30d: 500,
            expired30d: 0,
            redemptions30d: 2,
            spend30d: 1_000_000,
            rewardValue30d: 100_000,
            promosSent30d: 4,
        })
    })

    it("counts the birthdays of the month and the members of each tier", () => {
        expect(stats.birthdaysThisMonth).toBe(1)
        expect(stats.tierCounts).toEqual([
            { key: "dong", name: "\u0110\u1ed3ng", count: 2 },
            { key: "bac", name: "B\u1ea1c", count: 1 },
            { key: "vang", name: "V\u00e0ng", count: 0 },
        ])
    })
})

describe("activityOf", () => {
    it("tells active, at risk and new members", () => {
        expect(MEMBERS.map((m) => activityOf(m, NOW))).toEqual(["active", "at_risk", "new", "at_risk", "at_risk"])
    })
})

describe("computeFigures", () => {
    it("draws the ribbon from the same rows as the tabs", () => {
        const stats = computeStats(MEMBERS, TOTALS, DEFAULT_CONFIG.tiers, 0, NOW, VN)
        expect(computeFigures(MEMBERS, stats, NOW)).toEqual({
            members: 5,
            activeMembers: 1,
            pointsIssued30d: 1000,
            redemptions30d: 2,
            pointsRedeemed30d: 500,
            atRisk: 3,
        })
    })
})
