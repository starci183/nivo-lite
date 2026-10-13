import type { LoyaltyConfig, LoyaltyTier } from "@modules/domain/loyalty-programs"
import { pointsFor } from "./points.policy"

const CONFIG: LoyaltyConfig = {
    earn: {
        perThousandVnd: 1,
        perVisit: 0,
        categories: [
            { match: "Müsli", perThousandVnd: 3, label: "Coffee" },
            { match: "tea", perThousandVnd: 2, label: "" },
            { match: "water", perThousandVnd: 0.5, label: "Water" },
            { match: "", perThousandVnd: 9, label: "Nothing" },
        ],
        trigger: "payment",
        minOrderVnd: 10_000,
    },
    tiers: [],
    expiry: { months: 12, warnDays: 30 },
    birthday: { enabled: true, points: 100, rewardKey: "", note: "" },
    promo: { maxPerMonth: 4, hourFrom: "08:00", hourTo: "21:00", batch: 20 },
}
const SILVER: LoyaltyTier = {
    key: "bac",
    name: "Silver",
    minSpendVnd: 0,
    multiplier: 1.5,
    winbackDays: 45,
    benefit: "",
}

describe("points.policy", () => {
    describe("pointsFor", () => {
        it("earns the general rate on an order without a better category", () => {
            expect(pointsFor(CONFIG, { amountVnd: 50_500, items: "bread" }, null)).toEqual({
                points: 50,
                rate: 1,
                label: "",
                multiplier: 1,
                tierName: "",
                perVisit: 0,
                belowMinimum: false,
            })
        })

        it("takes the better rate of a category found in the items, accents and case ignored", () => {
            const calc = pointsFor(CONFIG, { amountVnd: 10_000, items: "2 MUSLI sua" }, null)

            expect(calc).toMatchObject({ points: 30, rate: 3, label: "Coffee" })
        })

        it("names the rate by the word of a rule that has no label", () => {
            expect(pointsFor(CONFIG, { amountVnd: 10_000, items: "green tea" }, null)).toMatchObject({
                rate: 2,
                label: "tea",
            })
        })

        it("takes the best of several matching categories and ignores a rule that is not better than the general rate", () => {
            expect(pointsFor(CONFIG, { amountVnd: 10_000, items: "tea and musli and water" }, null)).toMatchObject({
                rate: 3,
            })
            expect(pointsFor(CONFIG, { amountVnd: 10_000, items: "water" }, null)).toMatchObject({ rate: 1, label: "" })
        })

        it("multiplies the spend points by the tier and adds the points of the visit after", () => {
            const config = { ...CONFIG, earn: { ...CONFIG.earn, perVisit: 5 } }

            expect(pointsFor(config, { amountVnd: 10_000, items: "" }, SILVER)).toMatchObject({
                points: 20,
                multiplier: 1.5,
                tierName: "Silver",
                perVisit: 5,
            })
        })

        it("earns nothing below the smallest order or for a spend of zero", () => {
            expect(pointsFor(CONFIG, { amountVnd: 9_999, items: "" }, SILVER)).toMatchObject({
                points: 0,
                belowMinimum: true,
                multiplier: 1.5,
                tierName: "Silver",
            })
            expect(
                pointsFor({ ...CONFIG, earn: { ...CONFIG.earn, minOrderVnd: 0 } }, { amountVnd: 0, items: "" }, null)
                    .points,
            ).toBe(0)
            expect(pointsFor(CONFIG, { amountVnd: -5, items: "" }, null).belowMinimum).toBe(true)
        })
    })
})
