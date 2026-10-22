import { sql } from "@modules/platform/database"

/** The rule of one action of the workspace. */
export const FIND_RULE = sql`
    SELECT r.id, r.department, r.action, r.mode, r.limit_vnd::float8 AS limit_vnd, r.required_fields, r.unit,
           r.auto_max::float8 AS auto_max, r.ask_max::float8 AS ask_max, r.agents::text[] AS agents
    FROM public.authority_rules r
    WHERE r.workspace_id = $1 AND r.action = $2
    LIMIT 1`

/** The approval side of the rule of one action of the workspace ($1 workspace, $2 action). */
export const FIND_APPROVAL_SETUP = sql`
    SELECT r.department, r.action, r.mode, r.unit, r.auto_max::float8 AS auto_max, r.ask_max::float8 AS ask_max,
           r.approver_roles, r.approver_rooms, r.approver_members::text[] AS approver_members, r.approval_policy,
           r.timeout_minutes, r.agents::text[] AS agents
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
           r.note, to_json(r.updated_at) #>> '{}' AS updated_at, r.unit, r.auto_max::float8 AS auto_max,
           r.ask_max::float8 AS ask_max, r.agents::text[] AS agents, r.approver_roles, r.approver_rooms,
           r.approver_members::text[] AS approver_members, r.approval_policy, r.timeout_minutes
    FROM public.authority_rules r
    WHERE r.workspace_id = $1
    ORDER BY r.department ASC, r.action ASC
    LIMIT 500`

/**
 * Creates or replaces the rule of one action. The department must be the module the registry gives that action, so a
 * mismatched pair inserts nothing. A null note leaves the stored note; a text replaces it. $8 is the approval settings as a JSON
 * object holding only the keys the caller named: a named key replaces the stored value (a null band clears it), an absent key keeps
 * it, and a new rule takes the table default
 * ($1 workspace, $2 action, $3 mode, $4 limit, $5 required fields, $6 department, $7 note or null, $8 settings JSON).
 */
export const UPSERT_RULE = sql`
    INSERT INTO public.authority_rules AS r (workspace_id, department, action, mode, limit_vnd, required_fields, note, unit,
                                             auto_max, ask_max, approver_roles, approver_rooms, approver_members,
                                             approval_policy, timeout_minutes, agents)
    SELECT $1, a.module_key, a.action, $3, $4::bigint, $5::text[], COALESCE($7, ''),
           COALESCE($8::jsonb ->> 'unit', 'vnd'),
           ($8::jsonb ->> 'auto_max')::numeric,
           ($8::jsonb ->> 'ask_max')::numeric,
           CASE WHEN $8::jsonb ? 'approver_roles'
                THEN ARRAY(SELECT jsonb_array_elements_text($8::jsonb -> 'approver_roles'))
                ELSE ARRAY['owner', 'manager']::text[] END,
           CASE WHEN $8::jsonb ? 'approver_rooms'
                THEN ARRAY(SELECT jsonb_array_elements_text($8::jsonb -> 'approver_rooms'))
                ELSE '{}'::text[] END,
           CASE WHEN $8::jsonb ? 'approver_members'
                THEN ARRAY(SELECT jsonb_array_elements_text($8::jsonb -> 'approver_members'))::uuid[]
                ELSE '{}'::uuid[] END,
           COALESCE($8::jsonb ->> 'approval_policy', 'any'),
           COALESCE(($8::jsonb ->> 'timeout_minutes')::integer, 30),
           CASE WHEN $8::jsonb ? 'agents'
                THEN ARRAY(SELECT jsonb_array_elements_text($8::jsonb -> 'agents'))::uuid[]
                ELSE '{}'::uuid[] END
    FROM public.authority_actions a
    WHERE a.action = $2 AND a.module_key = $6
    ON CONFLICT (workspace_id, department, action) DO UPDATE
    SET mode = excluded.mode, limit_vnd = excluded.limit_vnd, required_fields = excluded.required_fields,
        note = CASE WHEN $7::text IS NULL THEN r.note ELSE excluded.note END,
        unit = COALESCE($8::jsonb ->> 'unit', r.unit),
        auto_max = CASE WHEN $8::jsonb ? 'auto_max' THEN ($8::jsonb ->> 'auto_max')::numeric ELSE r.auto_max END,
        ask_max = CASE WHEN $8::jsonb ? 'ask_max' THEN ($8::jsonb ->> 'ask_max')::numeric ELSE r.ask_max END,
        approver_roles = CASE WHEN $8::jsonb ? 'approver_roles' THEN excluded.approver_roles ELSE r.approver_roles END,
        approver_rooms = CASE WHEN $8::jsonb ? 'approver_rooms' THEN excluded.approver_rooms ELSE r.approver_rooms END,
        approver_members = CASE WHEN $8::jsonb ? 'approver_members' THEN excluded.approver_members ELSE r.approver_members END,
        approval_policy = COALESCE($8::jsonb ->> 'approval_policy', r.approval_policy),
        timeout_minutes = COALESCE(($8::jsonb ->> 'timeout_minutes')::integer, r.timeout_minutes),
        agents = CASE WHEN $8::jsonb ? 'agents' THEN excluded.agents ELSE r.agents END,
        updated_at = now()
    RETURNING r.id, r.workspace_id, r.department, r.action, r.mode, r.limit_vnd::float8 AS limit_vnd, r.required_fields,
              r.note, to_json(r.updated_at) #>> '{}' AS updated_at, r.unit, r.auto_max::float8 AS auto_max,
              r.ask_max::float8 AS ask_max, r.agents::text[] AS agents, r.approver_roles, r.approver_rooms,
              r.approver_members::text[] AS approver_members, r.approval_policy, r.timeout_minutes`

/** Grants the default rules of a module, never overwriting a rule the owner already set ($1 workspace, $2 module, $3 defaults JSON). */
export const SEED_DEFAULT_RULES = sql`
    INSERT INTO public.authority_rules (workspace_id, department, action, mode, limit_vnd, required_fields)
    SELECT $1, $2, d.action, d.mode, d.limit_vnd, ARRAY(SELECT jsonb_array_elements_text(d.required_fields))
    FROM jsonb_to_recordset($3::jsonb) AS d(action text, mode text, limit_vnd bigint, required_fields jsonb)
    ON CONFLICT (workspace_id, department, action) DO NOTHING`
