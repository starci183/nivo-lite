/** The billing columns a workspace without a tier or seat count holds. */
export const NO_TIER = { tier_credits: null, seat_count: null, billing_cycle: null, billed_monthly_vnd: null }
/** A workspace on the starter plan. */
export const WORKSPACE_ROW: BillingRow = { status: "active", plan_code: "starter", paid_until: null, ...NO_TIER }

/** The billing columns of a workspace in the shape of the scenarios, as the owner of the workspaces answers them. */
export interface BillingRow {
    readonly status: string
    readonly plan_code: string | null
    readonly paid_until: string | null
    readonly tier_credits: number | null
    readonly seat_count: number | null
    readonly billing_cycle: "monthly" | "annual" | null
    readonly billed_monthly_vnd: number | null
}

/** The billing facts the workspaces owner answers for that row. */
export const factsOf = (row: BillingRow) => ({
    status: row.status,
    planCode: row.plan_code,
    paidUntil: row.paid_until === null ? null : new Date(row.paid_until),
    tierCredits: row.tier_credits,
    seatCount: row.seat_count,
    billingCycle: row.billing_cycle,
    billedMonthlyVnd: row.billed_monthly_vnd,
})
