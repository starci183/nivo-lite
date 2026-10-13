import { sql } from "@modules/platform/database"

/** Pending notes of one installation, oldest first ($1 workspace, $2 installation). */
export const LIST_PENDING_NOTES = sql`
    SELECT id, installation_id AS "installationId", body, source, author_name AS "authorName",
           author_role AS "authorRole", status, to_json(created_at) #>> '{}' AS "createdAt"
    FROM public.module_context_notes
    WHERE workspace_id = $1 AND installation_id = $2 AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT 200`

/** Dismisses one pending note ($1 workspace, $2 note, $3 who decided, $4 when). */
export const DISMISS_NOTE = sql`
    WITH changed AS (
        UPDATE public.module_context_notes
        SET status = 'dismissed', decided_by = $3, decided_at = $4
        WHERE workspace_id = $1 AND id = $2 AND status = 'pending'
        RETURNING installation_id AS "installationId", fact_key AS "factKey")
    SELECT "installationId", "factKey" FROM changed`
