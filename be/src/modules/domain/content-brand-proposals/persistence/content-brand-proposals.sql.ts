import { sql } from "@modules/platform/database"

/** Stores one proposal ($1 workspace, $2 installation, $3 session, $4 file name, $5 size, $6 kit json). */
export const INSERT_BRAND_PROPOSAL = sql`INSERT INTO public.content_brand_proposals
(workspace_id, installation_id, setup_session_id, file_name, file_size, payload)
VALUES ($1, $2, $3, $4, $5, $6::jsonb)
RETURNING id, workspace_id, installation_id, setup_session_id, file_name, file_size, payload, status, decided_by,
    to_json(created_at) #>> '{}' AS created_at`

/** One proposal of the workspace ($1 workspace, $2 id). */
export const FIND_BRAND_PROPOSAL = sql`SELECT id, workspace_id, installation_id, setup_session_id, file_name, file_size, payload, status, decided_by,
    to_json(created_at) #>> '{}' AS created_at
FROM public.content_brand_proposals
WHERE workspace_id = $1 AND id = $2
LIMIT 1`

/** The newest proposals of an installation ($1 workspace, $2 installation). */
export const LIST_BRAND_PROPOSALS = sql`SELECT id, workspace_id, installation_id, setup_session_id, file_name, file_size, payload, status, decided_by,
    to_json(created_at) #>> '{}' AS created_at
FROM public.content_brand_proposals
WHERE workspace_id = $1 AND installation_id = $2
ORDER BY created_at DESC
LIMIT 10`

/** Closes a waiting proposal ($1 workspace, $2 id, $3 status, $4 kit json, $5 who); no row when it was decided already. */
export const CLOSE_BRAND_PROPOSAL = sql`WITH changed AS (UPDATE public.content_brand_proposals
SET status = $3, payload = $4::jsonb, decided_by = $5, decided_at = now()
WHERE workspace_id = $1 AND id = $2 AND status = 'proposed'
RETURNING id, workspace_id, installation_id, setup_session_id, file_name, file_size, payload, status, decided_by,
    created_at)
SELECT id, workspace_id, installation_id, setup_session_id, file_name, file_size, payload, status, decided_by,
    to_json(created_at) #>> '{}' AS created_at
FROM changed`
