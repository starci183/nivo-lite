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
}

describe("billing mapper", () => {
    describe("toPlan", () => {
        it("maps the columns, keeping only the text lines of the feature lists", () => {
            expect(toPlan(ROW)).toEqual({
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
            })
        })

        it.each([[{}], [[1]], ["text"], [5], [{ vi: "x", en: null }]])(
            "counts the stored features %p as empty lists",
            (features) => {
                expect(toPlan({ ...ROW, features }).features).toEqual({ vi: [], en: [] })
            },
        )
    })

    describe("toWorkspaceBilling", () => {
        it("maps a paid period to ISO text", () => {
            expect(
                toWorkspaceBilling({ status: "active", plan_code: "starter", paid_until: "2026-11-01T00:00:00+00:00" }),
            ).toEqual({
                status: "active",
                planCode: "starter",
                paidUntil: "2026-11-01T00:00:00.000Z",
            })
        })

        it("keeps the null period of an unpaid workspace", () => {
            expect(toWorkspaceBilling({ status: "pending_payment", plan_code: null, paid_until: null })).toEqual({
                status: "pending_payment",
                planCode: null,
                paidUntil: null,
            })
        })
    })
})
