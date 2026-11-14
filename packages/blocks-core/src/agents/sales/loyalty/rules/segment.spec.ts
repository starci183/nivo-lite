import type { LoyaltyMember } from "./ledger.types"
import { inSegment } from "./segment"
import type { Segment } from "./segment.types"

const DAY = 86_400_000
const NOW = Date.UTC(2026, 10, 5, 5)
const VN = "Asia/Ho_Chi_Minh"
const ago = (days: number): string => new Date(NOW - days * DAY).toISOString()

const MEMBER: LoyaltyMember = {
    id: "m",
    tierKey: "bac",
    points: 10,
    lifetimeSpendVnd: 4_000_000,
    lastVisitAt: ago(40),
    joinedAt: ago(200),
    birthday: "1990-11-20",
}
const ALL: Segment = { tiers: [], inactiveDays: 0, birthdayThisMonth: false, minSpendVnd: 0 }

describe("inSegment", () => {
    it("holds everyone when no condition is set", () => {
        expect(inSegment(MEMBER, ALL, NOW, VN)).toBe(true)
    })

    it("narrows by tier, and a member without a tier is outside any tier list", () => {
        expect(inSegment(MEMBER, { ...ALL, tiers: ["bac", "vang"] }, NOW, VN)).toBe(true)
        expect(inSegment(MEMBER, { ...ALL, tiers: ["vang"] }, NOW, VN)).toBe(false)
        expect(inSegment({ ...MEMBER, tierKey: null }, { ...ALL, tiers: ["bac"] }, NOW, VN)).toBe(false)
    })

    it("narrows by the least spend", () => {
        expect(inSegment(MEMBER, { ...ALL, minSpendVnd: 4_000_000 }, NOW, VN)).toBe(true)
        expect(inSegment(MEMBER, { ...ALL, minSpendVnd: 4_000_001 }, NOW, VN)).toBe(false)
    })

    it("narrows by days without a visit, counting from the join day for a member who never bought", () => {
        expect(inSegment(MEMBER, { ...ALL, inactiveDays: 30 }, NOW, VN)).toBe(true)
        expect(inSegment(MEMBER, { ...ALL, inactiveDays: 60 }, NOW, VN)).toBe(false)
        expect(inSegment({ ...MEMBER, lastVisitAt: null }, { ...ALL, inactiveDays: 150 }, NOW, VN)).toBe(true)
    })

    it("a workspace in another zone reads this month at its own clock: 31 Oct 20:00 UTC is November in Vietnam, October in Berlin", () => {
        const lateOctober = Date.UTC(2026, 9, 31, 20)
        expect(inSegment(MEMBER, { ...ALL, birthdayThisMonth: true }, lateOctober, VN)).toBe(true)
        expect(inSegment(MEMBER, { ...ALL, birthdayThisMonth: true }, lateOctober, "Europe/Berlin")).toBe(false)
    })

    it("narrows to the birthdays of this month in the workspace's time zone", () => {
        expect(inSegment(MEMBER, { ...ALL, birthdayThisMonth: true }, NOW, VN)).toBe(true)
        expect(inSegment({ ...MEMBER, birthday: "1990-01-02" }, { ...ALL, birthdayThisMonth: true }, NOW, VN)).toBe(false)
        expect(inSegment({ ...MEMBER, birthday: null }, { ...ALL, birthdayThisMonth: true }, NOW, VN)).toBe(false)
    })
})
