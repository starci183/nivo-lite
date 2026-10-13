import { sql } from "@modules/platform/database"

/** Moves one lead of the workspace to a stage and answers it ($1 workspace, $2 lead, $3 stage). */
export const UPDATE_LEAD_STAGE = sql`WITH changed AS (
    UPDATE public.leads SET stage = $3 WHERE workspace_id = $1 AND id = $2
    RETURNING id, contact_name, company, channel, need, origin, stage
)
SELECT id, contact_name, company, channel, need, origin, stage FROM changed`
