import { toPlan, toWorkspaceBilling } from "./billing.mapper"
import type { PlanRow } from "./persistence/billing.rows"

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

describe("billing mapper", () => {
    describe("toPlan", () => {
        it("maps the columns, keeping only the text lines of the feature lists", () => {
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
            (features) => {
                expect(toPlan({ ...ROW, features }, []).features).toEqual({ vi: [], en: [] })
            },
        )
    })

    describe("toWorkspaceBilling", () => {
        it("maps a paid period to ISO text", () => {
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

        it("keeps the null period of an unpaid workspace", () => {
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
})
