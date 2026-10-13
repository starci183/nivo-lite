import type { LoyaltyConfig } from "@modules/domain/loyalty-programs"
import type { ExpiryEntry } from "../loyalty-ledger.contracts"
import { expirablePoints, expiringSoon, expiryDate } from "./expiry.policy"

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 12)
const at = (days: number): string => new Date(NOW + days * DAY).toISOString()
const earn = (points: number, days: number | null): ExpiryEntry => ({
    kind: "earn",
    points,
    expiresAt: days === null ? null : at(days),
})
const redeem = (points: number): ExpiryEntry => ({ kind: "redeem", points: -points, expiresAt: null })

describe("expiry.policy", () => {
    describe("expirablePoints", () => {
        it("counts the earned points whose date passed", () => {
            expect(expirablePoints([earn(100, -1), earn(50, 10)], NOW)).toBe(100)
        })

        it("lets what was already spent or expired use up the oldest points first", () => {
            expect(expirablePoints([earn(100, -1), earn(50, 10), redeem(120)], NOW)).toBe(0)
            expect(expirablePoints([earn(100, -1), earn(100, -2), redeem(120)], NOW)).toBe(80)
            expect(expirablePoints([earn(100, -1), { kind: "expire", points: -30, expiresAt: null }], NOW)).toBe(70)
        })

        it("never exceeds the balance and ignores earned points without a date", () => {
            expect(expirablePoints([earn(100, -1), { kind: "adjust", points: -60, expiresAt: null }], NOW)).toBe(40)
            expect(expirablePoints([earn(100, null)], NOW)).toBe(0)
        })
    })

    describe("expiringSoon", () => {
        it("counts the points that expire inside the window and tells when the first batch does", () => {
            const result = expiringSoon([earn(100, 20), earn(40, 5), earn(10, 60), earn(7, null)], NOW, 30)

            expect(result).toEqual({ points: 140, firstAt: at(5) })
        })

        it("is empty when nothing expires inside the window", () => {
            expect(expiringSoon([earn(10, 60), redeem(5)], NOW, 30)).toEqual({ points: 0, firstAt: null })
        })

        it("ignores points that already expired", () => {
            expect(expiringSoon([earn(100, -1)], NOW, 30)).toEqual({ points: 0, firstAt: null })
        })
    })

    describe("expiryDate", () => {
        const config = (months: number): LoyaltyConfig => ({
            earn: { perThousandVnd: 1, perVisit: 0, categories: [], trigger: "payment", minOrderVnd: 0 },
            tiers: [],
            expiry: { months, warnDays: 30 },
            birthday: { enabled: true, points: 100, rewardKey: "", note: "" },
            promo: { maxPerMonth: 4, hourFrom: "08:00", hourTo: "21:00", batch: 20 },
        })

        it("moves the date by the months of the programme", () => {
            expect(expiryDate(config(12), Date.UTC(2026, 9, 12))).toBe("2027-10-12T00:00:00.000Z")
        })

        it("is null when points never expire", () => {
            expect(expiryDate(config(0), NOW)).toBeNull()
        })
    })
})
