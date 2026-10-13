import { sql } from "@modules/platform/database"

/** Upserts the authority action rows from one JSON array of records ($1); answers the actions written. */
export const UPSERT_AUTHORITY_ACTIONS = sql`
INSERT INTO public.authority_actions (
    action, module_key, sort_order, default_mode, default_limit_vnd, default_required_fields, amount_limit, max_mode,
    label
)
SELECT
    d.action, d.module_key, d.sort_order, d.default_mode, d.default_limit_vnd, d.default_required_fields,
    d.amount_limit, d.max_mode, d.label
FROM jsonb_to_recordset($1::jsonb) AS d(
    action text, module_key text, sort_order int, default_mode text, default_limit_vnd bigint,
    default_required_fields text[], amount_limit boolean, max_mode text, label jsonb
)
ON CONFLICT (action) DO UPDATE SET
    module_key = EXCLUDED.module_key,
    sort_order = EXCLUDED.sort_order,
    default_mode = EXCLUDED.default_mode,
    default_limit_vnd = EXCLUDED.default_limit_vnd,
    default_required_fields = EXCLUDED.default_required_fields,
    amount_limit = EXCLUDED.amount_limit,
    max_mode = EXCLUDED.max_mode,
    label = EXCLUDED.label
RETURNING action`

/** Reads the keys of the authority action rows the database holds, bounded. */
export const LIST_ACTION_KEYS = sql`SELECT action FROM public.authority_actions ORDER BY action LIMIT 500`

/** Reads every authority action row of the catalogue, in module and position order, bounded. */
export const LIST_AUTHORITY_ACTIONS = sql`
SELECT action, module_key, sort_order, default_mode, default_limit_vnd::float8 AS default_limit_vnd, default_required_fields,
       amount_limit, max_mode, label
FROM public.authority_actions
ORDER BY module_key, sort_order, action
LIMIT 500`
