import type { BillingWorkspace, Plan, PlanFeatures, PlanLookup, WorkspaceBilling } from "./billing.contracts"
import type { BillingWorkspaceRow, PlanRow, WorkspaceBillingRow } from "./persistence/billing.rows"

const linesOf = (value: unknown): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((line): line is string => typeof line === "string") : []

/** The feature lists of a plan: a stored value that is not the { vi, en } object counts as empty lists. */
const featuresOf = (value: PlanRow["features"]): PlanFeatures =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? { vi: linesOf(value.vi), en: linesOf(value.en) }
        : { vi: [], en: [] }

/** Maps one plan row to the plan the capability answers. */
export const toPlan = (row: PlanRow): Plan => ({
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
})

/** Maps the billing columns of a workspace, its paid period as ISO text. */
export const toWorkspaceBilling = (row: WorkspaceBillingRow): WorkspaceBilling => ({
    status: row.status,
    planCode: row.plan_code,
    paidUntil: row.paid_until === null ? null : new Date(row.paid_until).toISOString(),
})

/** Maps a billing workspace with the caller's membership. */
export const toBillingWorkspace = (row: BillingWorkspaceRow): BillingWorkspace => ({
    ...toWorkspaceBilling(row),
    id: row.id,
    name: row.name,
    role: row.role,
})

/** Maps a single-plan lookup, preserving the absent-plan result. */
export const toPlanLookup = (rows: ReadonlyArray<PlanRow>): PlanLookup => {
    const row = rows[0]
    return row === undefined ? null : toPlan(row)
}
