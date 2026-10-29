import { builder } from "@starci/jest-preset"
import { PlanEntity, PlanUsageTierEntity } from "@modules/domain/billing"

/** A listed monthly plan with the fields a spec rarely changes filled. */
export const planOf = builder<PlanEntity>({
    code: "starter",
    nameVi: "Khoi dau",
    nameEn: "Starter",
    priceVnd: 990000,
    period: "month",
    seats: 3,
    features: { vi: ["a"], en: ["b"] },
    sort: 1,
    active: true,
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
})

/** The plan a new workspace starts on, with the default price and no annual discount. */
export const starterPlan = (): PlanEntity => planOf()

/** The starter plan with a year price at a 17 percent discount. */
export const annualPlan = (): PlanEntity => planOf({ priceAnnualVnd: 9900000, annualDiscountPct: 17 })

/** The starter plan with an intro price of two months. */
export const promoPlan = (): PlanEntity => planOf({ promoPriceVnd: 490000, promoMonths: 2 })

/** The starter plan agreed by contract. */
export const customPlan = (): PlanEntity => planOf({ isCustom: true })

/** The starter plan nobody new can buy any more. */
export const unlistedPlan = (): PlanEntity => planOf({ listed: false })

/** A per-seat plan whose allowance comes from its tiers. */
export const teamPlan = (): PlanEntity => planOf({ code: "team", perSeat: true, seats: 10, aiCreditsPerMonth: null })

/** The 5000-credit tier of the team plan. */
export const teamTier = builder<PlanUsageTierEntity>({
    planCode: "team",
    creditsPerMonth: 5000,
    priceVnd: 200000,
    perSeat: true,
    sort: 1,
})

/** A usage tier of a plan, the allowance of which is paid per seat. */
export const tierOf = builder<PlanUsageTierEntity>({
    planCode: "starter",
    creditsPerMonth: 1000,
    priceVnd: 50000,
    perSeat: true,
    sort: 0,
})

/** The 1000-credit per-seat tier of the starter plan. */
export const starterTier = (): PlanUsageTierEntity => tierOf()

/** A per-seat tier of a plan other than the starter. */
export const otherPlanTier = (): PlanUsageTierEntity =>
    tierOf({ planCode: "other", creditsPerMonth: 9000, priceVnd: 90000 })

/** A pack of 3000 credits that the starter plan sells outside its seats. */
export const starterPack = (): PlanUsageTierEntity => tierOf({ creditsPerMonth: 3000, priceVnd: 70000, perSeat: false })

/** A pack of another plan. */
export const otherPlanPack = (): PlanUsageTierEntity =>
    tierOf({ planCode: "other", creditsPerMonth: 8000, priceVnd: 80000, perSeat: false })

/** The starter plan whose stored feature lists carry a value that is not text. */
export const mixedFeaturesPlan = (): PlanEntity => planOf({ features: { vi: ["a", 5, "b"], en: ["c"] } })

/** The starter plan with no stored feature lists. */
export const bareFeaturesPlan = (): PlanEntity => planOf({ features: null })

/** A plan of another code. */
export const otherPlan = (): PlanEntity => planOf({ code: "other" })
