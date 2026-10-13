import { sql } from "@modules/platform/database"

/** The billing facts of a workspace ($1 id). */
export const FIND_BILLING = sql`
    SELECT paid_until, status, plan_code
    FROM public.workspaces
    WHERE id = $1
    LIMIT 1`

/** Sets the paid-until instant ($1 id, $2 instant). */
export const UPDATE_PAID_UNTIL = sql`UPDATE public.workspaces SET paid_until = $2 WHERE id = $1`

/** Sets the billing status ($1 id, $2 status). */
export const UPDATE_STATUS = sql`UPDATE public.workspaces SET status = $2 WHERE id = $1`

/** Moves a workspace to a plan ($1 id, $2 code). */
export const UPDATE_PLAN = sql`UPDATE public.workspaces SET plan_code = $2 WHERE id = $1`

/** An active plan by code ($1). */
export const FIND_ACTIVE_PLAN = sql`
    SELECT code
    FROM public.plans
    WHERE code = $1 AND active = true
    LIMIT 1`
