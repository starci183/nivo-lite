/** The billing columns of a workspace. */
export interface BillingRow {
    /** When the subscription ends. */
    readonly paid_until: string | null
    /** The billing status. */
    readonly status: string
    /** The plan code. */
    readonly plan_code: string | null
}

/** The code of a plan. */
export interface PlanRow {
    /** The plan code. */
    readonly code: string
}
