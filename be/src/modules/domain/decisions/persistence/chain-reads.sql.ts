import { sql } from "@modules/platform/database"

/** Whether a follow-up of the customer already waits for a decision ($1 workspace, $2 lead). */
export const FOLLOW_UP_IS_PENDING = sql`
    SELECT EXISTS (
        SELECT 1 FROM public.work_items
        WHERE workspace_id = $1::uuid AND lead_id = $2::uuid AND action = 'send_follow_up' AND status = 'waiting_decision'
    ) AS pending`

/** The stage of a customer ($1 workspace, $2 lead). */
export const FIND_LEAD_STAGE = sql`
    SELECT stage FROM public.leads
    WHERE workspace_id = $1::uuid AND id = $2::uuid
    LIMIT 1`
