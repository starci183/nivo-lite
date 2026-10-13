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

/** The agents that use a connection. */
export const FIND_CONNECTION_AGENT_IDS = sql`SELECT agent_id FROM public.agent_connections WHERE workspace_id = $1 AND connection_id = $2 ORDER BY created_at`

/** The connection a delivery arrived on, when it is of the provider and not disconnected ($1 connection id, $2 provider). */
export const FIND_INTAKE_CONNECTION = sql`SELECT id, workspace_id, status
FROM public.connections
WHERE id = $1 AND provider = $2 AND status <> 'disconnected'
LIMIT 1`

/** Marks a connection as failing with the reason the owner reads ($1 connection id, $2 reason). */
export const MARK_CONNECTION_ERROR = sql`UPDATE public.connections
SET status = 'error', last_error = $2, updated_at = now()
WHERE id = $1`

/** The connection works: pending or failing becomes connected, and the first event is kept for the wizard's check ($1 connection id, $2 first event). */
export const MARK_CONNECTION_RECEIVED = sql`UPDATE public.connections
SET last_event_at = now(),
    updated_at = now(),
    status = CASE WHEN status IN ('pending', 'error') THEN 'connected' ELSE status END,
    last_error = CASE WHEN status IN ('pending', 'error') THEN NULL ELSE last_error END,
    first_event = COALESCE(first_event, $2::jsonb)
WHERE id = $1`

/** Records the OA the owner authorized and clears an error status ($1 connection id, $2 meta patch). */
export const APPLY_ZALO_AUTHORIZATION = sql`UPDATE public.connections
SET public_meta = public_meta || $2::jsonb,
    status = CASE WHEN status = 'error' THEN 'connected' ELSE status END,
    last_error = NULL,
    updated_at = now()
WHERE id = $1`

/** A page of the connections the health check judges, in id order ($1 after id, $2 page size). */
export const LIST_HEALTH_BATCH = sql`SELECT id, workspace_id, provider, name, status, coalesce(last_error, '') AS last_error,
       coalesce(last_event_at::text, '') AS last_event_at, created_at::text AS created_at,
       coalesce(public_meta -> 'health' ->> 'state', '') AS health
FROM public.connections
WHERE status <> 'disconnected' AND id > $1
ORDER BY id
LIMIT $2`

/** Records the health verdict in the public facts of a connection ($1 connection id, $2 verdict). */
export const MARK_CONNECTION_HEALTH = sql`UPDATE public.connections
SET public_meta = jsonb_set(public_meta, '{health}', $2::jsonb)
WHERE id = $1`

/** Writes the result of a wizard job next to its ticket, only while that ticket is still the latest ($1 connection id, $2 ticket, $3 facts to merge). */
export const SETTLE_WIZARD = sql`UPDATE public.connections
SET public_meta = public_meta || $3::jsonb,
    updated_at = now()
WHERE id = $1 AND public_meta -> 'wizard' ->> 'ticket' = $2`

/** The sync schedule of a connection of a workspace ($1 workspace, $2 connection). */
export const FIND_SYNC_SCHEDULE = sql`SELECT sync_every_minutes, to_char(last_sync_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_sync_at
FROM public.connections
WHERE workspace_id = $1 AND id = $2
LIMIT 1`

/** Sets how often a connection syncs by itself; null is manual only and the first scheduled sync is due now ($1 workspace, $2 connection, $3 minutes). */
export const SET_SYNC_SCHEDULE = sql`UPDATE public.connections
SET sync_every_minutes = $3::int,
    next_sync_at = CASE WHEN $3::int IS NULL THEN NULL ELSE now() END,
    updated_at = now()
WHERE workspace_id = $1 AND id = $2
RETURNING id`

/** A sync finished: the connection works, the next one is scheduled and the new public facts join the old ones ($1 connection, $2 facts to merge). */
export const MARK_SYNCED = sql`UPDATE public.connections
SET status = 'connected',
    last_error = NULL,
    last_sync_at = now(),
    last_event_at = now(),
    next_sync_at = CASE WHEN sync_every_minutes IS NULL THEN NULL ELSE now() + make_interval(mins => sync_every_minutes) END,
    public_meta = public_meta || $2::jsonb,
    updated_at = now()
WHERE id = $1`

/** A sync failed: the reason is shown to the owner and the retry waits at least a quarter of an hour ($1 connection, $2 reason). */
export const MARK_SYNC_FAILED = sql`UPDATE public.connections
SET status = 'error',
    last_error = $2,
    next_sync_at = CASE WHEN sync_every_minutes IS NULL THEN NULL ELSE now() + make_interval(mins => GREATEST(sync_every_minutes, 15)) END,
    updated_at = now()
WHERE id = $1`

/** Claims the connections of the given providers whose scheduled sync is due: their next sync moves half an hour on, so a second tick does not queue them again, and the sync itself sets the real time ($1 providers, $2 page size). */
export const CLAIM_DUE_SYNCS = sql`WITH due AS (
    SELECT id
    FROM public.connections
    WHERE provider = ANY($1::text[]) AND status <> 'disconnected' AND next_sync_at IS NOT NULL AND next_sync_at <= now()
    ORDER BY next_sync_at
    LIMIT $2
    FOR UPDATE SKIP LOCKED
), claimed AS (
    UPDATE public.connections AS c
    SET next_sync_at = now() + interval '30 minutes'
    FROM due
    WHERE c.id = due.id
    RETURNING c.id, c.workspace_id
)
SELECT id, workspace_id FROM claimed`

/** Makes one SMTP connection the workspace default and every other one a spare ($1 workspace, $2 connection). */
export const SET_DEFAULT_SMTP = sql`UPDATE public.connections
SET is_default = (id = $2), updated_at = now()
WHERE workspace_id = $1 AND provider = 'smtp' AND (is_default OR id = $2)`

/** The id of the connected default SMTP connection of a workspace, if any ($1 workspace). */
export const FIND_DEFAULT_SMTP = sql`SELECT id
FROM public.connections
WHERE workspace_id = $1 AND provider = 'smtp' AND is_default AND status <> 'disconnected'
LIMIT 1`
