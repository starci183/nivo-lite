import { sql } from "@modules/platform/database"

/** Verifies a key hash, counts this minute's request and stamps its last use in ONE round trip ($1 hash); answers jsonb or null. */
export const API_KEY_AUTH = sql`SELECT public.api_key_auth($1) AS auth`

/** The role and display name of an active member of a workspace ($1 workspace, $2 user). */
export const SELECT_MEMBER = sql`SELECT role, display_name FROM public.workspace_members
WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`

/** The keys of a workspace, newest first ($1 workspace). */
export const LIST_KEYS = sql`SELECT id, name, key_prefix,
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
    to_char(last_used_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_used_at,
    to_char(revoked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS revoked_at FROM public.workspace_api_keys
WHERE workspace_id = $1
ORDER BY created_at DESC`

/** How many keys of a workspace still work ($1 workspace). */
export const COUNT_ACTIVE_KEYS = sql`SELECT count(*)::int AS active FROM public.workspace_api_keys
WHERE workspace_id = $1 AND revoked_at IS NULL`

/** Stores a new key by its hash and answers it ($1 workspace, $2 name, $3 prefix, $4 hash, $5 creator). */
export const INSERT_KEY = sql`INSERT INTO public.workspace_api_keys (workspace_id, name, key_prefix, key_hash, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, name, key_prefix,
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
    to_char(last_used_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_used_at,
    to_char(revoked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS revoked_at`

/** Revokes a working key of a workspace and answers it; a missing or already revoked key answers no row ($1 workspace, $2 id). */
export const REVOKE_KEY = sql`UPDATE public.workspace_api_keys SET revoked_at = now()
WHERE id = $2 AND workspace_id = $1 AND revoked_at IS NULL
RETURNING id, name, key_prefix,
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
    to_char(last_used_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_used_at,
    to_char(revoked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS revoked_at`

/** Appends one evidence line for a key event ($1 workspace, $2 kind, $3 actor, $4 summary, $5 evidence). */
export const INSERT_EVIDENCE = sql`INSERT INTO public.events (workspace_id, kind, actor, summary, evidence)
VALUES ($1, $2, $3, $4, $5)`
