import { Test } from "@nestjs/testing"

import {
    toBillingWorkspace as realToBillingWorkspace,
    toPlan as realToPlan,
    toPlanLookup as realToPlanLookup,
    toWorkspaceBilling as realToWorkspaceBilling,
} from "./billing.mapper"

import {
    bareFeaturesPlan,
    mixedFeaturesPlan,
    otherPlan,
    otherPlanPack,
    otherPlanTier,
    planOf,
    starterPack,
    starterTier,
} from "@tests/fixtures/builders/plans.builder"

const SUBJECT = Symbol("billing.mapper")

const NO_TIER = { tierCredits: null, seatCount: null, billingCycle: null, billedMonthlyVnd: null } as const

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    toBillingWorkspace: realToBillingWorkspace,
                    toPlan: realToPlan,
                    toPlanLookup: realToPlanLookup,
                    toWorkspaceBilling: realToWorkspaceBilling,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<{
        toBillingWorkspace: typeof realToBillingWorkspace
        toPlan: typeof realToPlan
        toPlanLookup: typeof realToPlanLookup
        toWorkspaceBilling: typeof realToWorkspaceBilling
    }>(SUBJECT)
    const toBillingWorkspace = subject.toBillingWorkspace
    const toPlan = subject.toPlan
    const toPlanLookup = subject.toPlanLookup
    const toWorkspaceBilling = subject.toWorkspaceBilling

    return { toBillingWorkspace, toPlan, toPlanLookup, toWorkspaceBilling }
}

describe("billing mapper > toPlan", () => {
    it("maps the columns, keeping only the text lines of the feature lists", async () => {
        const { toPlan } = await buildSubject()

        expect(toPlan(mixedFeaturesPlan(), [])).toEqual({
            code: "starter",
            nameVi: "Khoi dau",
            nameEn: "Starter",
            priceVnd: 990000,
            period: "month",
            seats: 3,
            features: { vi: ["a", "b"], en: ["c"] },
            sort: 1,
            aiCreditsPerMonth: 3000,
            isCustom: false,
            priceAnnualVnd: null,
            annualDiscountPct: null,
            promoPriceVnd: null,
            promoMonths: null,
            storageGb: null,
            individual: false,
            perSeat: false,
            listed: true,
            tiers: [],
            packs: [],
        })
    })

    it.each([[{}], [[1]], ["text"], [5], [{ vi: "x", en: null }]])(
        "counts the stored features %p as empty lists",
        async (features) => {
            const { toPlan } = await buildSubject()

            expect(toPlan(planOf({ features }), []).features).toEqual({ vi: [], en: [] })
        },
    )

    it("counts null stored features as empty lists", async () => {
        const { toPlan } = await buildSubject()

        expect(toPlan(bareFeaturesPlan(), []).features).toEqual({ vi: [], en: [] })
    })

    it("maps matching per-seat tiers and add-on packs, excluding rows of another plan", async () => {
        const { toPlan } = await buildSubject()

        const plan = toPlan(mixedFeaturesPlan(), [starterTier(), otherPlanTier(), starterPack(), otherPlanPack()])

        expect(plan.tiers).toEqual([{ creditsPerMonth: 1000, priceVnd: 50000, perSeat: true }])
        expect(plan.packs).toEqual([{ creditsPerMonth: 3000, priceVnd: 70000, perSeat: false }])
    })
})

describe("billing mapper > toWorkspaceBilling", () => {
    it("maps a paid period to ISO text", async () => {
        const { toWorkspaceBilling } = await buildSubject()

        expect(
            toWorkspaceBilling({
                ...NO_TIER,
                status: "active",
                planCode: "starter",
                paidUntil: new Date("2026-11-01T00:00:00.000Z"),
            }),
        ).toEqual({
            status: "active",
            planCode: "starter",
            paidUntil: "2026-11-01T00:00:00.000Z",
            tierCredits: null,
            seatCount: null,
            billingCycle: null,
            billedMonthlyVnd: null,
        })
    })

    it("keeps the null period of an unpaid workspace", async () => {
        const { toWorkspaceBilling } = await buildSubject()

        expect(toWorkspaceBilling({ ...NO_TIER, status: "pending_payment", planCode: null, paidUntil: null })).toEqual({
            status: "pending_payment",
            planCode: null,
            paidUntil: null,
            tierCredits: null,
            seatCount: null,
            billingCycle: null,
            billedMonthlyVnd: null,
        })
    })
})

describe("billing mapper > toBillingWorkspace", () => {
    it("combines the billing state and caller membership", async () => {
        const { toBillingWorkspace } = await buildSubject()

        expect(
            toBillingWorkspace(
                {
                    status: "active",
                    planCode: "team",
                    paidUntil: new Date("2026-11-01T00:00:00.000Z"),
                    tierCredits: 5000,
                    seatCount: 4,
                    billingCycle: "annual",
                    billedMonthlyVnd: 200000,
                },
                { id: "ws-1", name: "Acme", role: "manager" },
            ),
        ).toEqual({
            id: "ws-1",
            name: "Acme",
            role: "manager",
            status: "active",
            planCode: "team",
            paidUntil: "2026-11-01T00:00:00.000Z",
            tierCredits: 5000,
            seatCount: 4,
            billingCycle: "annual",
            billedMonthlyVnd: 200000,
        })
    })
})

describe("billing mapper > toPlanLookup", () => {
    it("answers null for an absent plan", async () => {
        const { toPlanLookup } = await buildSubject()

        expect(toPlanLookup([], [])).toBeNull()
    })

    it("maps only the first plan and its matching tiers", async () => {
        const { toPlanLookup } = await buildSubject()

        expect(toPlanLookup([mixedFeaturesPlan(), otherPlan()], [starterTier()])).toEqual({
            code: "starter",
            nameVi: "Khoi dau",
            nameEn: "Starter",
            priceVnd: 990000,
            period: "month",
            seats: 3,
            features: { vi: ["a", "b"], en: ["c"] },
            sort: 1,
            aiCreditsPerMonth: 3000,
            isCustom: false,
            priceAnnualVnd: null,
            annualDiscountPct: null,
            promoPriceVnd: null,
            promoMonths: null,
            storageGb: null,
            individual: false,
            perSeat: false,
            listed: true,
            tiers: [{ creditsPerMonth: 1000, priceVnd: 50000, perSeat: true }],
            packs: [],
        })
    })
})
