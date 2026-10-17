import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { LedgerTotal, LoyaltyMember } from "@modules/domain/loyalty-ledger"
import type { LoyaltyTier } from "@modules/domain/loyalty-programs"
import { computeFigures, computeStats } from "./overview.policy"

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 12)
const ago = (days: number): string => new Date(NOW - days * DAY).toISOString()
const memberOf = builder<LoyaltyMember>({
    id: "c1",
    name: "Mai",
    phone: null,
    email: null,
    birthday: null,
    tierKey: "bac",
    points: 10,
    lifetimeSpendVnd: 0,
    visits: 0,
    lastVisitAt: ago(5),
    joinedAt: ago(200),
    note: "",
})
const TIERS: ReadonlyArray<LoyaltyTier> = [
    { key: "dong", name: "Bronze", minSpendVnd: 0, multiplier: 1, winbackDays: 60, benefit: "" },
    { key: "bac", name: "Silver", minSpendVnd: 1, multiplier: 1, winbackDays: 60, benefit: "" },
]
const TOTALS: ReadonlyArray<LedgerTotal> = [
    { kind: "earn", entries: 4, points: 400, amountVnd: 400000 },
    { kind: "redeem", entries: 2, points: -150, amountVnd: 60000 },
    { kind: "expire", entries: 1, points: -20, amountVnd: 0 },
]

const SUBJECT = Symbol("overview.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { computeStats, computeFigures } }],
    }).compile()
    return moduleRef.get<{ computeStats: typeof computeStats; computeFigures: typeof computeFigures }>(SUBJECT)
}

describe("overview.policy", () => {
    describe("computeStats", () => {
        it("sums members and what the ledger moved", async () => {
            const subject = await buildSubject()

            const members = [
                memberOf({ points: 10, lastVisitAt: ago(5), birthday: "1990-10-03" }),
                memberOf({ id: "c2", points: 30, lastVisitAt: ago(100), tierKey: "dong", birthday: "1990-01-03" }),
                memberOf({ id: "c3", points: 0, lastVisitAt: null, tierKey: null }),
            ]

            expect(subject.computeStats(members, TOTALS, TIERS, 7, NOW)).toEqual({
                members: 3,
                active90d: 1,
                pointsOutstanding: 40,
                earned30d: 400,
                redeemed30d: 150,
                expired30d: 20,
                redemptions30d: 2,
                spend30d: 400000,
                rewardValue30d: 60000,
                promosSent30d: 7,
                birthdaysThisMonth: 1,
                tierCounts: [
                    { key: "dong", name: "Bronze", count: 1 },
                    { key: "bac", name: "Silver", count: 1 },
                ],
            })
        })

        it("is all zeros for an empty programme", async () => {
            const subject = await buildSubject()

            expect(subject.computeStats([], [], [], 0, NOW)).toEqual({
                members: 0,
                active90d: 0,
                pointsOutstanding: 0,
                earned30d: 0,
                redeemed30d: 0,
                expired30d: 0,
                redemptions30d: 0,
                spend30d: 0,
                rewardValue30d: 0,
                promosSent30d: 0,
                birthdaysThisMonth: 0,
                tierCounts: [],
            })
        })
    })

    describe("computeFigures", () => {
        it("counts recent and at-risk customers, using joining for those who never bought", async () => {
            const subject = await buildSubject()

            const members = [
                memberOf({ lastVisitAt: ago(5) }),
                memberOf({ id: "c2", lastVisitAt: ago(70) }),
                memberOf({ id: "c3", lastVisitAt: null, joinedAt: ago(10) }),
                memberOf({ id: "c4", lastVisitAt: null, joinedAt: ago(90) }),
            ]
            const stats = subject.computeStats(members, TOTALS, TIERS, 0, NOW)

            expect(subject.computeFigures(members, stats, NOW)).toEqual({
                members: 4,
                activeMembers: 1,
                pointsIssued30d: 400,
                redemptions30d: 2,
                pointsRedeemed30d: 150,
                atRisk: 2,
            })
        })
    })
})
