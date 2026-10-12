import { sql } from "@modules/platform/database"

/** The active membership (role and display name) of a user in a workspace. */
export const FIND_ACTIVE_MEMBER = sql`SELECT role, display_name FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`

/** One connection of a workspace. */
export const FIND_CONNECTION = sql`SELECT id, workspace_id, provider, name, public_meta, status, last_error, environment, is_default, to_char(last_event_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_event_at, first_event, created_by, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at FROM public.connections WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** Several connections of a workspace by id. */
export const FIND_CONNECTIONS_BY_IDS = sql`SELECT id, workspace_id, provider, name, public_meta, status, last_error, environment, is_default, to_char(last_event_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_event_at, first_event, created_by, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at FROM public.connections WHERE workspace_id = $1 AND id = ANY($2::uuid[]) ORDER BY created_at`

/** Every connection of a workspace except the Drive read grant, which lives in the documents drawer. */
export const LIST_CONNECTIONS = sql`SELECT id, workspace_id, provider, name, public_meta, status, last_error, environment, is_default, to_char(last_event_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_event_at, first_event, created_by, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at FROM public.connections WHERE workspace_id = $1 AND provider <> 'google_drive' ORDER BY created_at`

/** The connections of one provider, disconnected ones only when asked. */
export const LIST_CONNECTIONS_BY_PROVIDER = sql`SELECT id, workspace_id, provider, name, public_meta, status, last_error, environment, is_default, to_char(last_event_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_event_at, first_event, created_by, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at FROM public.connections WHERE workspace_id = $1 AND provider = $2 AND ($3::boolean OR status <> 'disconnected') ORDER BY created_at`

/** Inserts a connection row. */
export const INSERT_CONNECTION = sql`INSERT INTO public.connections (workspace_id, provider, name, status, environment, created_by, public_meta) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING id`

/** Inserts the secret of a connection. */
export const INSERT_SECRET = sql`INSERT INTO public.connection_secrets (connection_id, ciphertext, webhook_secret) VALUES ($1, $2, $3)`

/** Changes the given fields of a connection; a null parameter keeps the column, except the last error which has its own switch. */
export const PATCH_CONNECTION = sql`UPDATE public.connections SET name = COALESCE($3, name), status = COALESCE($4, status), environment = COALESCE($5, environment), public_meta = COALESCE($6::jsonb, public_meta), last_error = CASE WHEN $7::boolean THEN $8 ELSE last_error END, updated_at = now() WHERE workspace_id = $1 AND id = $2 RETURNING id`

/** Reads the sealed secret of a connection. */
export const FIND_SECRET = sql`SELECT ciphertext, webhook_secret FROM public.connection_secrets WHERE connection_id = $1 LIMIT 1`

/** Stores or replaces a secret; the webhook secret is replaced only when the fourth parameter says so. */
export const UPSERT_SECRET = sql`INSERT INTO public.connection_secrets (connection_id, ciphertext, webhook_secret) VALUES ($1, $2, $3) ON CONFLICT (connection_id) DO UPDATE SET ciphertext = excluded.ciphertext, webhook_secret = CASE WHEN $4::boolean THEN excluded.webhook_secret ELSE public.connection_secrets.webhook_secret END`

/** Wipes the secret of a connection. */
export const DELETE_SECRET = sql`DELETE FROM public.connection_secrets WHERE connection_id = $1`

/** Removes a connection of a workspace. */
export const DELETE_CONNECTION = sql`DELETE FROM public.connections WHERE workspace_id = $1 AND id = $2 RETURNING id`

/** Notes that a connection received an event: it works now, remember when, and keep the very first one. */
export const RECORD_EVENT = sql`UPDATE public.connections SET last_event_at = $2::timestamptz, last_error = NULL, updated_at = $2::timestamptz, status = CASE WHEN status IN ('pending', 'error') THEN 'connected' ELSE status END, first_event = COALESCE(first_event, $3::jsonb) WHERE id = $1 RETURNING name, environment`

/** Records that a workspace wants a planned connector, once. */
export const INSERT_CONNECTOR_INTEREST = sql`INSERT INTO public.connector_interest (workspace_id, connector_id, user_id) VALUES ($1, $2, $3) ON CONFLICT (workspace_id, connector_id) DO NOTHING`

/** The oldest live connection of a provider whose public fact `key` equals `value` (a Telegram bot id, a Meta Page id). */
export const FIND_LIVE_BY_META = sql`SELECT id, workspace_id FROM public.connections WHERE provider = $1 AND public_meta ->> $2 = $3 AND status <> 'disconnected' ORDER BY created_at LIMIT 1`
