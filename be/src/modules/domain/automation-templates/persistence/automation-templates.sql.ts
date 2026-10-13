import { sql } from "@modules/platform/database"

/** Reads the whole catalogue in gallery order; it is bounded by the number of templates, far under the limit. */
export const SELECT_TEMPLATES = sql`SELECT key, definition FROM public.automation_templates ORDER BY position, key LIMIT 500`

/** Writes one template, replacing the row of the same key ($1 key, $2 version, $3 module, $4 pack, $5 executor, $6 position, $7 definition). */
export const UPSERT_TEMPLATE = sql`INSERT INTO public.automation_templates (key, version, module_key, pack, executor, position, definition, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
ON CONFLICT (key) DO UPDATE
SET version = EXCLUDED.version, module_key = EXCLUDED.module_key, pack = EXCLUDED.pack, executor = EXCLUDED.executor,
    position = EXCLUDED.position, definition = EXCLUDED.definition, updated_at = now()
RETURNING key`
