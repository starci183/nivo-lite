import { Test } from "@nestjs/testing"
import type { LoyaltyConfig, LoyaltyTier } from "@modules/domain/loyalty-programs"
import { pointsFor } from "./points.policy"

const SUBJECT = Symbol("points.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { pointsFor } }],
    }).compile()
    return moduleRef.get<typeof import("./points.policy")>(SUBJECT)
}

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
        it("earns the general rate on an order without a better category", async () => {
            const subject = await build()

            expect(subject.pointsFor(CONFIG, { amountVnd: 50_500, items: "bread" }, null)).toEqual({
                points: 50,
                rate: 1,
                label: "",
                multiplier: 1,
                tierName: "",
                perVisit: 0,
                belowMinimum: false,
            })
        })

        it("takes the better rate of a category found in the items, accents and case ignored", async () => {
            const subject = await build()

            const calc = subject.pointsFor(CONFIG, { amountVnd: 10_000, items: "2 MUSLI sua" }, null)

            expect(calc).toMatchObject({ points: 30, rate: 3, label: "Coffee" })
        })

        it("names the rate by the word of a rule that has no label", async () => {
            const subject = await build()

            expect(subject.pointsFor(CONFIG, { amountVnd: 10_000, items: "green tea" }, null)).toMatchObject({
                rate: 2,
                label: "tea",
            })
        })

        it("takes the best matching category and ignores rules below the general rate", async () => {
            const subject = await build()

            expect(
                subject.pointsFor(CONFIG, { amountVnd: 10_000, items: "tea and musli and water" }, null),
            ).toMatchObject({
                rate: 3,
            })
            expect(subject.pointsFor(CONFIG, { amountVnd: 10_000, items: "water" }, null)).toMatchObject({
                rate: 1,
                label: "",
            })
        })

        it("multiplies the spend points by the tier and adds the points of the visit after", async () => {
            const subject = await build()

            const config = { ...CONFIG, earn: { ...CONFIG.earn, perVisit: 5 } }

            expect(subject.pointsFor(config, { amountVnd: 10_000, items: "" }, SILVER)).toMatchObject({
                points: 20,
                multiplier: 1.5,
                tierName: "Silver",
                perVisit: 5,
            })
        })

        it("earns nothing below the smallest order or for a spend of zero", async () => {
            const subject = await build()

            expect(subject.pointsFor(CONFIG, { amountVnd: 9_999, items: "" }, SILVER)).toMatchObject({
                points: 0,
                belowMinimum: true,
                multiplier: 1.5,
                tierName: "Silver",
            })
            expect(
                subject.pointsFor(
                    { ...CONFIG, earn: { ...CONFIG.earn, minOrderVnd: 0 } },
                    { amountVnd: 0, items: "" },
                    null,
                ).points,
            ).toBe(0)
            expect(subject.pointsFor(CONFIG, { amountVnd: -5, items: "" }, null).belowMinimum).toBe(true)
        })
    })
})
