import { sql } from "@modules/platform/database"

/** Writes one console audit row ($1 email, $2 user, $3 action, $4 workspace, $5 data as JSON text). */
export const INSERT_AUDIT = sql`INSERT INTO public.platform_audit (actor_email, actor_id, action, workspace_id, data)
VALUES ($1, $2, $3, $4, $5::jsonb)`

/** Reads the newest audit rows, page views of the health page left out. */
export const LIST_RECENT_AUDITS = sql`SELECT id, actor_email, action, workspace_id, created_at
FROM public.platform_audit
WHERE action <> 'view.health'
ORDER BY created_at DESC
LIMIT 15`
