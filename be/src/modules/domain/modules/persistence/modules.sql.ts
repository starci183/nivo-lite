import { sql } from "@modules/platform/database"

/** Upserts the module rows from one JSON array of records ($1) stamped with the sync time ($2); answers the keys written. */
export const UPSERT_MODULES = sql`
INSERT INTO public.modules (
    key, sort_order, status, category, audience, knowledge_folder, workbench, default_operating_mode, multi_instance,
    definition, updated_at
)
SELECT
    d.key, d.sort_order, d.status, d.category, d.audience, d.knowledge_folder, d.workbench, d.default_operating_mode,
    d.multi_instance, d.definition, $2::timestamptz
FROM jsonb_to_recordset($1::jsonb) AS d(
    key text, sort_order int, status text, category text, audience text, knowledge_folder text, workbench text,
    default_operating_mode text, multi_instance boolean, definition jsonb
)
ON CONFLICT (key) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    category = EXCLUDED.category,
    audience = EXCLUDED.audience,
    knowledge_folder = EXCLUDED.knowledge_folder,
    workbench = EXCLUDED.workbench,
    default_operating_mode = EXCLUDED.default_operating_mode,
    multi_instance = EXCLUDED.multi_instance,
    definition = EXCLUDED.definition,
    updated_at = EXCLUDED.updated_at
RETURNING key`

/** Reads the keys of the module rows the database holds, bounded. */
export const LIST_MODULE_KEYS = sql`SELECT key FROM public.modules ORDER BY key LIMIT 500`
