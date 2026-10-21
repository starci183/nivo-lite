import { sql } from "@modules/platform/database"

/**
 * Verifies a key hash, counts this minute's request and stamps its last use in ONE round trip ($1 hash); answers jsonb
 * or null.
 */
export const API_KEY_AUTH = sql`SELECT public.api_key_auth($1) AS auth`

/** The role of an active member of a workspace ($1 workspace, $2 user). */
export const SELECT_MEMBER = sql`SELECT role, display_name FROM public.workspace_members
WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
LIMIT 1`

/** The keys of a workspace, newest first ($1 workspace). */
export const LIST_KEYS = sql`SELECT id, name, key_prefix,
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
    to_char(last_used_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_used_at,
    to_char(revoked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS revoked_at, agent_id FROM public.api_keys
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT 100`

/** How many keys of a workspace still work ($1 workspace). */
export const COUNT_ACTIVE_KEYS = sql`SELECT count(*)::int AS active FROM public.api_keys
WHERE workspace_id = $1 AND revoked_at IS NULL`

/** Stores a new key by its hash and answers it ($1 workspace, $2 name, $3 prefix, $4 hash, $5 creator). */
export const INSERT_KEY = sql`INSERT INTO public.api_keys (workspace_id, name, key_prefix, key_hash, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, name, key_prefix,
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
    to_char(last_used_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_used_at,
    to_char(revoked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS revoked_at, agent_id`

/**
 * Revokes a working key of a workspace and answers it; a missing or already revoked key answers no row ($1 workspace,
 * $2 id).
 */
export const REVOKE_KEY = sql`WITH revoked AS (
    UPDATE public.api_keys SET revoked_at = now()
    WHERE id = $2 AND workspace_id = $1 AND revoked_at IS NULL
    RETURNING id, name, key_prefix, created_at, last_used_at, revoked_at, agent_id
)
SELECT id, name, key_prefix,
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
    to_char(last_used_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_used_at,
    to_char(revoked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS revoked_at, agent_id
FROM revoked`

/** Read-only credential proof by hash; the operation still accounts for exactly one rate hit ($1 hash). */
export const API_KEY_CREDENTIAL = sql`SELECT id, workspace_id, name, scopes,
    revoked_at IS NOT NULL AS revoked
FROM public.api_keys WHERE key_hash = $1 LIMIT 1`

/**
 * Stores a new key bound to an agent of the workspace, with only the agent scopes, and answers it; an agent that is not of the
 * workspace answers no row ($1 workspace, $2 name, $3 prefix, $4 hash, $5 creator, $6 agent, $7 scopes).
 */
export const INSERT_AGENT_KEY = sql`INSERT INTO public.api_keys (workspace_id, name, key_prefix, key_hash, created_by, agent_id, scopes)
SELECT $1::uuid, $2::text, $3::text, $4::text, $5::uuid, agents.id, $7::text[]
FROM public.agents
WHERE agents.id = $6::uuid AND agents.workspace_id = $1::uuid
LIMIT 1
RETURNING id, name, key_prefix,
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
    to_char(last_used_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_used_at,
    to_char(revoked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS revoked_at, agent_id`

/** An agent key by its hash, with its agent's status in the key's workspace (null when there is none) ($1 hash). */
export const API_AGENT_KEY = sql`SELECT api_keys.id, api_keys.workspace_id, api_keys.agent_id, api_keys.scopes,
    api_keys.revoked_at IS NOT NULL AS revoked, agents.status AS agent_status
FROM public.api_keys
LEFT JOIN public.agents ON agents.id = api_keys.agent_id AND agents.workspace_id = api_keys.workspace_id
WHERE api_keys.key_hash = $1
LIMIT 1`
