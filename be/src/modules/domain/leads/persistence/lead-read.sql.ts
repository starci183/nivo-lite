import { sql } from "@modules/platform/database"

/** Reads only the requested customer references, all within the selected workspace. */
export const LIST_LEAD_VIEWS_BY_IDS = sql`
    SELECT id, contact_name, company, channel, need, stage, context_summary, installation_id,
           to_json(created_at) #>> '{}' AS created_at
    FROM public.leads
    WHERE workspace_id = $1 AND id = ANY($2::uuid[])
    ORDER BY created_at DESC, id DESC
    LIMIT 1000`

/** Reads recent leads of the workspace with their creation time as ISO text. */
export const LIST_LEAD_VIEWS = sql`
    SELECT id, contact_name, company, channel, need, stage, context_summary, installation_id,
           to_json(created_at) #>> '{}' AS created_at
    FROM public.leads
    WHERE workspace_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT 500`

/** Reads one lead only within the selected workspace. */
export const FIND_LEAD_VIEW = sql`
    SELECT id, contact_name, company, channel, need, stage, context_summary, installation_id,
           to_json(created_at) #>> '{}' AS created_at
    FROM public.leads
    WHERE workspace_id = $1 AND id = $2
    LIMIT 1`
