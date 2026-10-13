import { sql } from "@modules/platform/database"

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

/** Every stored rule of the workspace. */
export const LIST_RULES = sql`
    SELECT r.id, r.workspace_id, r.department, r.action, r.mode, r.limit_vnd::float8 AS limit_vnd, r.required_fields,
           r.note, to_json(r.updated_at) #>> '{}' AS updated_at
    FROM public.authority_rules r
    WHERE r.workspace_id = $1
    ORDER BY r.department ASC, r.action ASC
    LIMIT 500`

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

/** Grants the default rules of a module, never overwriting a rule the owner already set ($1 workspace, $2 module, $3 defaults JSON). */
export const SEED_DEFAULT_RULES = sql`
    INSERT INTO public.authority_rules (workspace_id, department, action, mode, limit_vnd, required_fields)
    SELECT $1, $2, d.action, d.mode, d.limit_vnd, ARRAY(SELECT jsonb_array_elements_text(d.required_fields))
    FROM jsonb_to_recordset($3::jsonb) AS d(action text, mode text, limit_vnd bigint, required_fields jsonb)
    ON CONFLICT (workspace_id, department, action) DO NOTHING`
