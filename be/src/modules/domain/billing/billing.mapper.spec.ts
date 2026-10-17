import { Test } from "@nestjs/testing"

import {
    toBillingWorkspace as realToBillingWorkspace,
    toPlan as realToPlan,
    toPlanLookup as realToPlanLookup,
    toWorkspaceBilling as realToWorkspaceBilling,
} from "./billing.mapper"

import type { PlanRow } from "./persistence/billing.rows"

const SUBJECT = Symbol("billing.mapper")

const ROW: PlanRow = {
    code: "starter",
    name_vi: "Khoi dau",
    name_en: "Starter",
    price_vnd: 990000,
    period: "month",
    seats: 3,
    features: { vi: ["a", 5, "b"], en: ["c"] },
    sort: 1,
    ai_credits_per_month: 3000,
    is_custom: false,
    price_annual_vnd: null,
    annual_discount_pct: null,
    promo_price_vnd: null,
    promo_months: null,
    storage_gb: null,
    individual: false,
    per_seat: false,
    listed: true,
}

const NO_TIER = { tier_credits: null, seat_count: null, billing_cycle: null, billed_monthly_vnd: null } as const

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

        expect(toPlan(ROW, [])).toEqual({
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

            expect(toPlan({ ...ROW, features }, []).features).toEqual({ vi: [], en: [] })
        },
    )

    it("counts null stored features as empty lists", async () => {
        const { toPlan } = await buildSubject()

        expect(toPlan({ ...ROW, features: null }, []).features).toEqual({ vi: [], en: [] })
    })

    it("maps matching per-seat tiers and add-on packs, excluding rows of another plan", async () => {
        const { toPlan } = await buildSubject()

        const plan = toPlan(ROW, [
            { plan_code: "starter", credits_per_month: 1000, price_vnd: 50000, per_seat: true },
            { plan_code: "other", credits_per_month: 9000, price_vnd: 90000, per_seat: true },
            { plan_code: "starter", credits_per_month: 3000, price_vnd: 70000, per_seat: false },
            { plan_code: "other", credits_per_month: 8000, price_vnd: 80000, per_seat: false },
        ])

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
                plan_code: "starter",
                paid_until: "2026-11-01T00:00:00+00:00",
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

        expect(
            toWorkspaceBilling({ ...NO_TIER, status: "pending_payment", plan_code: null, paid_until: null }),
        ).toEqual({
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
            toBillingWorkspace({
                id: "ws-1",
                name: "Acme",
                role: "manager",
                status: "active",
                plan_code: "team",
                paid_until: "2026-11-01T07:00:00+07:00",
                tier_credits: 5000,
                seat_count: 4,
                billing_cycle: "annual",
                billed_monthly_vnd: 200000,
            }),
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

        expect(
            toPlanLookup(
                [ROW, { ...ROW, code: "other" }],
                [{ plan_code: "starter", credits_per_month: 1000, price_vnd: 50000, per_seat: true }],
            ),
        ).toEqual({
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
