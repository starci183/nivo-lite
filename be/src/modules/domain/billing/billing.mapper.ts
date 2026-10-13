import type { BillingWorkspace, Plan, PlanFeatures, PlanLookup, PlanTier, WorkspaceBilling } from "./billing.contracts"
import type { BillingWorkspaceRow, PlanRow, PlanTierRow, WorkspaceBillingRow } from "./persistence/billing.rows"

const linesOf = (value: unknown): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((line): line is string => typeof line === "string") : []

/** The feature lists of a plan: a stored value that is not the { vi, en } object counts as empty lists. */
const featuresOf = (value: PlanRow["features"]): PlanFeatures =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? { vi: linesOf(value.vi), en: linesOf(value.en) }
        : { vi: [], en: [] }

/** Maps one usage tier row. */
export const toPlanTier = (row: PlanTierRow): PlanTier => ({
    creditsPerMonth: row.credits_per_month,
    priceVnd: row.price_vnd,
    perSeat: row.per_seat,
})

/** Maps one plan row and the usage tiers of the plan to the plan the capability answers. */
export const toPlan = (row: PlanRow, tiers: ReadonlyArray<PlanTierRow>): Plan => ({
    code: row.code,
    nameVi: row.name_vi,
    nameEn: row.name_en,
    priceVnd: row.price_vnd,
    period: row.period,
    seats: row.seats,
    features: featuresOf(row.features),
    sort: row.sort,
    aiCreditsPerMonth: row.ai_credits_per_month,
    isCustom: row.is_custom,
    priceAnnualVnd: row.price_annual_vnd,
    annualDiscountPct: row.annual_discount_pct,
    promoPriceVnd: row.promo_price_vnd,
    promoMonths: row.promo_months,
    storageGb: row.storage_gb,
    individual: row.individual,
    perSeat: row.per_seat,
    listed: row.listed,
    tiers: tiers.filter((tier) => tier.plan_code === row.code).map(toPlanTier),
})

/** Maps the billing columns of a workspace, its paid period as ISO text. */
export const toWorkspaceBilling = (row: WorkspaceBillingRow): WorkspaceBilling => ({
    status: row.status,
    planCode: row.plan_code,
    paidUntil: row.paid_until === null ? null : new Date(row.paid_until).toISOString(),
    tierCredits: row.tier_credits,
    seatCount: row.seat_count,
    billingCycle: row.billing_cycle,
    billedMonthlyVnd: row.billed_monthly_vnd,
})

/** Maps a billing workspace with the caller's membership. */
export const toBillingWorkspace = (row: BillingWorkspaceRow): BillingWorkspace => ({
    ...toWorkspaceBilling(row),
    id: row.id,
    name: row.name,
    role: row.role,
})

/** Maps a single-plan lookup, preserving the absent-plan result. */
export const toPlanLookup = (rows: ReadonlyArray<PlanRow>, tiers: ReadonlyArray<PlanTierRow>): PlanLookup => {
    const row = rows[0]
    return row === undefined ? null : toPlan(row, tiers)
}
