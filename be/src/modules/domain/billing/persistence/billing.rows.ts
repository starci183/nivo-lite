import type { Database } from "../../../../../../supabase/types/database.types"

type Tables = Database["public"]["Tables"]

/** One plan as the catalogue statements answer it; the money columns are cast to float8 in SQL so the driver answers numbers. */
export interface PlanRow extends Pick<
    Tables["plans"]["Row"],
    "code" | "name_vi" | "name_en" | "seats" | "features" | "sort" | "is_custom"
> {
    /** The price of one period in VND. */
    readonly price_vnd: number
    /** The billing period, a member of the table check. */
    readonly period: "month" | "year"
    /** The monthly AI credits; null is unlimited. */
    readonly ai_credits_per_month: number | null
}

/** The role of one member of a workspace. */
export type MemberRoleRow = Pick<Tables["workspace_members"]["Row"], "role">

/** The billing columns of one workspace. */
export type WorkspaceBillingRow = Pick<Tables["workspaces"]["Row"], "status" | "plan_code" | "paid_until">
