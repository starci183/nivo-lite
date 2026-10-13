import { builder } from "@starci/jest-preset"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import type { Segment } from "../loyalty-campaigns.contracts"
import { inSegment, segmentParts } from "./segment.policy"

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 12)
const memberOf = builder<LoyaltyMember>({
    id: "c1",
    name: "Mai",
    phone: null,
    email: null,
    birthday: null,
    tierKey: "bac",
    points: 0,
    lifetimeSpendVnd: 1_000_000,
    visits: 1,
    lastVisitAt: new Date(NOW - 10 * DAY).toISOString(),
    joinedAt: new Date(NOW - 100 * DAY).toISOString(),
    note: "",
})
const ANY: Segment = { tiers: [], inactiveDays: 0, birthdayThisMonth: false, minSpendVnd: 0 }

describe("segment.policy", () => {
    describe("inSegment", () => {
        it("holds every customer when no condition is set", () => {
            expect(inSegment(memberOf(), ANY, NOW)).toBe(true)
        })

        it("filters by tier, treating a customer without one as matching none", () => {
            expect(inSegment(memberOf(), { ...ANY, tiers: ["bac", "vang"] }, NOW)).toBe(true)
            expect(inSegment(memberOf(), { ...ANY, tiers: ["vang"] }, NOW)).toBe(false)
            expect(inSegment(memberOf({ tierKey: null }), { ...ANY, tiers: ["vang"] }, NOW)).toBe(false)
        })

        it("filters by the spend", () => {
            expect(inSegment(memberOf(), { ...ANY, minSpendVnd: 1_000_000 }, NOW)).toBe(true)
            expect(inSegment(memberOf(), { ...ANY, minSpendVnd: 1_000_001 }, NOW)).toBe(false)
        })

        it("filters by days without a visit, counting from the day of joining for a customer who never bought", () => {
            expect(inSegment(memberOf(), { ...ANY, inactiveDays: 5 }, NOW)).toBe(true)
            expect(inSegment(memberOf(), { ...ANY, inactiveDays: 30 }, NOW)).toBe(false)
            expect(inSegment(memberOf({ lastVisitAt: null }), { ...ANY, inactiveDays: 30 }, NOW)).toBe(true)
            expect(inSegment(memberOf({ lastVisitAt: null }), { ...ANY, inactiveDays: 365 }, NOW)).toBe(false)
        })

        it("filters by the birthday month in Vietnam time", () => {
            const segment = { ...ANY, birthdayThisMonth: true }

            expect(inSegment(memberOf({ birthday: "1990-10-03" }), segment, NOW)).toBe(true)
            expect(inSegment(memberOf({ birthday: "1990-11-03" }), segment, NOW)).toBe(false)
            expect(inSegment(memberOf({ birthday: null }), segment, NOW)).toBe(false)
        })
    })

    describe("segmentParts", () => {
        it("lists each condition with the values of its text", () => {
            const parts = segmentParts(
                { tiers: ["bac", "x"], inactiveDays: 30, birthdayThisMonth: true, minSpendVnd: 500000 },
                new Map([["bac", "Silver"]]),
            )

            expect(parts).toEqual([
                { key: "loyalty.segment.tiers", params: { tiers: "Silver, x" } },
                { key: "loyalty.segment.inactive", params: { days: 30 } },
                { key: "loyalty.segment.birthday", params: {} },
                { key: "loyalty.segment.minSpend", params: { amount: 500000 } },
            ])
        })

        it("is empty for every customer", () => {
            expect(segmentParts(ANY, new Map())).toEqual([])
        })
    })
})
