import type { BillingWorkspace, Plan, PlanFeatures, PlanLookup, PlanTier, WorkspaceBilling } from "./billing.contracts"
import type { BillingWorkspaceRead, WorkspaceBillingRead } from "./billing-reads.contracts"
import type { PlanEntity, PlanUsageTierEntity } from "./persistence/entities"

const linesOf = (value: unknown): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((line): line is string => typeof line === "string") : []

/** The feature lists of a plan: a stored value that is not the { vi, en } object counts as empty lists. */
const featuresOf = (value: unknown): PlanFeatures =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? { vi: linesOf((value as Record<string, unknown>).vi), en: linesOf((value as Record<string, unknown>).en) }
        : { vi: [], en: [] }

/** Maps one usage tier row. */
export const toPlanTier = (row: PlanUsageTierEntity): PlanTier => ({
    creditsPerMonth: row.creditsPerMonth,
    priceVnd: row.priceVnd,
    perSeat: row.perSeat,
})

/** Maps one plan row and the usage tiers of the plan to the plan the capability answers. */
export const toPlan = (row: PlanEntity, tiers: ReadonlyArray<PlanUsageTierEntity>): Plan => ({
    code: row.code,
    nameVi: row.nameVi,
    nameEn: row.nameEn,
    priceVnd: row.priceVnd,
    period: row.period,
    seats: row.seats,
    features: featuresOf(row.features),
    sort: row.sort,
    aiCreditsPerMonth: row.aiCreditsPerMonth,
    isCustom: row.isCustom,
    priceAnnualVnd: row.priceAnnualVnd,
    annualDiscountPct: row.annualDiscountPct,
    promoPriceVnd: row.promoPriceVnd,
    promoMonths: row.promoMonths,
    storageGb: row.storageGb,
    individual: row.individual,
    perSeat: row.perSeat,
    listed: row.listed,
    tiers: tiers.filter((tier) => tier.planCode === row.code && tier.perSeat).map(toPlanTier),
    packs: tiers.filter((tier) => tier.planCode === row.code && !tier.perSeat).map(toPlanTier),
})

/** Maps the billing columns of a workspace, its paid period as ISO text. */
export const toWorkspaceBilling = (row: WorkspaceBillingRead): WorkspaceBilling => ({
    status: row.status,
    planCode: row.plan_code,
    paidUntil: row.paid_until === null ? null : new Date(row.paid_until).toISOString(),
    tierCredits: row.tier_credits,
    seatCount: row.seat_count,
    billingCycle: row.billing_cycle,
    billedMonthlyVnd: row.billed_monthly_vnd,
})

/** Maps a billing workspace with the caller's membership. */
export const toBillingWorkspace = (row: BillingWorkspaceRead): BillingWorkspace => ({
    ...toWorkspaceBilling(row),
    id: row.id,
    name: row.name,
    role: row.role,
})

/** Maps a single-plan lookup, preserving the absent-plan result. */
export const toPlanLookup = (
    rows: ReadonlyArray<PlanEntity>,
    tiers: ReadonlyArray<PlanUsageTierEntity>,
): PlanLookup => {
    const row = rows[0]
    return row === undefined ? null : toPlan(row, tiers)
}
