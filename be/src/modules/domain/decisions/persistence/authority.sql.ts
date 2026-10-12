import { sql } from "@modules/platform/database"

/** The goals and house rules the prompts carry. */
export const FIND_AUTHORITY = sql`
    SELECT a.policies, a.reply_style, a.brand_voice, a.limits_note
    FROM public.authority a
    WHERE a.workspace_id = $1
    LIMIT 1`

/** The rule of one action of the workspace. */
export const FIND_RULE = sql`
    SELECT r.id, r.department, r.action, r.mode, r.limit_vnd::float8 AS limit_vnd, r.required_fields
    FROM public.authority_rules r
    WHERE r.workspace_id = $1 AND r.action = $2
    LIMIT 1`

/** The operating mode of the instance that handles an action: the named instance, else the module's oldest one. */
export const FIND_OPERATING_MODE = sql`
    SELECT i.operating_mode
    FROM public.module_installations i
    WHERE i.workspace_id = $1 AND i.module_key = $2 AND ($3::uuid IS NULL OR i.id = $3::uuid)
    ORDER BY i.created_at ASC, i.id ASC
    LIMIT 1`

/** The whole authority sheet of the workspace. */
export const FIND_AUTHORITY_PROFILE = sql`
    SELECT a.policies, a.reply_style, a.brand_voice, a.limits_note,
           a.goal_revenue_vnd::float8 AS goal_revenue_vnd, a.goal_new_customers, a.goal_first_reply_minutes,
           a.goal_note, a.updated_by, to_json(a.updated_at) #>> '{}' AS updated_at
    FROM public.authority a
    WHERE a.workspace_id = $1
    LIMIT 1`

/** Every stored rule of the workspace. */
export const LIST_RULES = sql`
    SELECT r.id, r.workspace_id, r.department, r.action, r.mode, r.limit_vnd::float8 AS limit_vnd, r.required_fields,
           r.note, to_json(r.updated_at) #>> '{}' AS updated_at
    FROM public.authority_rules r
    WHERE r.workspace_id = $1
    ORDER BY r.department ASC, r.action ASC
    LIMIT 500`

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

/** Creates or replaces the rule of one action; the module comes from the registry, so an unknown action inserts nothing. */
export const UPSERT_RULE = sql`
    INSERT INTO public.authority_rules (workspace_id, department, action, mode, limit_vnd, required_fields)
    SELECT $1, a.module_key, a.action, $3, $4::bigint, $5::text[]
    FROM public.authority_actions a
    WHERE a.action = $2
    ON CONFLICT (workspace_id, department, action) DO UPDATE
    SET mode = excluded.mode, limit_vnd = excluded.limit_vnd, required_fields = excluded.required_fields, updated_at = now()
    RETURNING id, workspace_id, department, action, mode, limit_vnd::float8 AS limit_vnd, required_fields, note,
              to_json(updated_at) #>> '{}' AS updated_at`
