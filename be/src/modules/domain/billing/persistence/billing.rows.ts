/** A JSON column as the driver answers it. */
export type JsonColumn = string | number | boolean | null | { [key: string]: JsonColumn } | Array<JsonColumn>

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
    readonly features: JsonColumn
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
}
