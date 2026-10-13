/** A JSON column as the driver answers it. */
export type JsonColumnRow = string | number | boolean | null | { [key: string]: JsonColumnRow } | Array<JsonColumnRow>

/** One plan as the catalogue statements answer it; the money columns are cast to float8 in SQL so the driver answers numbers. */
export interface PlanRow {
    /** The plan code. */
    readonly code: string
    /** The Vietnamese name. */
    readonly name_vi: string
    /** The English name. */
    readonly name_en: string
    /** The seats the plan includes. */
    readonly seats: number
    /** The feature lists, a { vi, en } object when well formed. */
    readonly features: JsonColumnRow
    /** The order of the catalogue. */
    readonly sort: number
    /** A contract plan. */
    readonly is_custom: boolean
    /** The price of one period in VND. */
    readonly price_vnd: number
    /** The billing period, a member of the table check. */
    readonly period: "month" | "year"
    /** The monthly AI credits; null is unlimited. */
    readonly ai_credits_per_month: number | null
    /** The price of a year paid at once, or null. */
    readonly price_annual_vnd: number | null
    /** The share saved by paying a year at once, or null. */
    readonly annual_discount_pct: number | null
    /** The monthly price of the intro months, or null. */
    readonly promo_price_vnd: number | null
    /** The paid months the intro price lasts, or null. */
    readonly promo_months: number | null
    /** The storage included in GB, or null. */
    readonly storage_gb: number | null
    /** One person only. */
    readonly individual: boolean
    /** Priced per seat. */
    readonly per_seat: boolean
    /** On sale to new customers. */
    readonly listed: boolean
}

/** One usage tier row; the money columns are cast to float8 in SQL. */
export interface PlanTierRow {
    /** The plan the tier belongs to. */
    readonly plan_code: string
    /** The credits a month. */
    readonly credits_per_month: number
    /** The price of a month in VND. */
    readonly price_vnd: number
    /** The price is per seat. */
    readonly per_seat: boolean
}

/** A count answered by a statement. */
export interface CountRow {
    /** The count. */
    readonly count: number
}

/** The payments a workspace already made for plan months. */
export interface PromoHistoryRow {
    /** Paid plan orders at full price. */
    readonly full_price: number
    /** Paid plan orders at the intro price. */
    readonly promo: number
}

/** The bytes a workspace keeps in storage. */
export interface StorageBytesRow {
    /** The sum of the object sizes. */
    readonly bytes: number
}

/** The role of one member of a workspace. */
export interface MemberRoleRow {
    /** The role, a member of the table check. */
    readonly role: string
}

/** The billing columns of one workspace. */
export interface WorkspaceBillingRow {
    /** The workspace status. */
    readonly status: string
    /** The plan code, or null before the first payment. */
    readonly plan_code: string | null
    /** The end of the paid period, or null. */
    readonly paid_until: string | null
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
export interface BillingWorkspaceRow extends WorkspaceBillingRow {
    /** The workspace id. */
    readonly id: string
    /** The workspace name. */
    readonly name: string
    /** The caller's membership role. */
    readonly role: string
}
