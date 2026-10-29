/** The billing columns of one workspace as the read of the workspaces table answers them (the money columns are cast to float8). */
export interface WorkspaceBillingRead {
    /** The workspace status. */
    readonly status: string
    /** The plan code, or null before the first payment. */
    readonly plan_code: string | null
    /** The end of the paid period, or null. */
    readonly paid_until: Date | string | null
    /** The picked monthly allowance, or null. */
    readonly tier_credits: number | null
    /** The paid seats, or null. */
    readonly seat_count: number | null
    /** The billing cycle, or null. */
    readonly billing_cycle: "monthly" | "annual" | null
    /** The full monthly price of what was bought, or null. */
    readonly billed_monthly_vnd: number | null
}

/** Billing state selected together with the caller's active membership. */
export interface BillingWorkspaceRead extends WorkspaceBillingRead {
    /** The workspace id. */
    readonly id: string
    /** The workspace name. */
    readonly name: string
    /** The caller's membership role. */
    readonly role: string
}

/** The payments a workspace already made for plan months. */
export interface PromoHistoryRead {
    /** Paid plan orders at full price. */
    readonly full_price: number
    /** Paid plan orders at the intro price. */
    readonly promo: number
}

/** One connection joined with its secret row. */
export interface ConnectionSecretRead {
    /** The workspace the connection belongs to. */
    readonly workspace_id: string
    /** The connection status. */
    readonly status: string
    /** The provider of the connection. */
    readonly provider: string
    /** The encrypted credential. */
    readonly ciphertext: string
    /** The per-connection webhook secret. */
    readonly webhook_secret: string
}

/** The facts of a connection the bank feed reads before it records a credit. */
export interface ConnectionStateRead {
    /** The connection name. */
    readonly name: string
    /** The environment the connection runs in. */
    readonly environment: string
}
