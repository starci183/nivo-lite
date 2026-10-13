import { sql } from "@modules/platform/database"

/** The goals and house rules the prompts carry. */
export const FIND_AUTHORITY = sql`
    SELECT a.policies, a.reply_style, a.brand_voice, a.limits_note
    FROM public.authority a
    WHERE a.workspace_id = $1
    LIMIT 1`

/** The whole authority sheet of the workspace. */
export const FIND_AUTHORITY_PROFILE = sql`
    SELECT a.policies, a.reply_style, a.brand_voice, a.limits_note,
           a.goal_revenue_vnd::float8 AS goal_revenue_vnd, a.goal_new_customers, a.goal_first_reply_minutes,
           a.goal_note, a.updated_by, to_json(a.updated_at) #>> '{}' AS updated_at
    FROM public.authority a
    WHERE a.workspace_id = $1
    LIMIT 1`

/** Creates or replaces the authority sheet of the workspace. */
export const UPSERT_AUTHORITY = sql`
    INSERT INTO public.authority (workspace_id, policies, reply_style, brand_voice, limits_note, goal_revenue_vnd,
                                  goal_new_customers, goal_first_reply_minutes, goal_note, updated_by, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6::bigint, $7, $8, $9, $10, now())
    ON CONFLICT (workspace_id) DO UPDATE
    SET policies = excluded.policies, reply_style = excluded.reply_style, brand_voice = excluded.brand_voice,
        limits_note = excluded.limits_note, goal_revenue_vnd = excluded.goal_revenue_vnd,
        goal_new_customers = excluded.goal_new_customers, goal_first_reply_minutes = excluded.goal_first_reply_minutes,
        goal_note = excluded.goal_note, updated_by = excluded.updated_by, updated_at = now()
    RETURNING policies, reply_style, brand_voice, limits_note, goal_revenue_vnd::float8 AS goal_revenue_vnd,
              goal_new_customers, goal_first_reply_minutes, goal_note, updated_by, to_json(updated_at) #>> '{}' AS updated_at`

/** Creates the empty authority sheet of a new workspace, stamped by NIVO; answers a row only when this call created it ($1 workspace). */
export const CREATE_AUTHORITY_IF_MISSING = sql`
    INSERT INTO public.authority (workspace_id, updated_by)
    VALUES ($1, 'NIVO')
    ON CONFLICT (workspace_id) DO NOTHING
    RETURNING workspace_id`
