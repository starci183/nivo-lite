import { sql } from "@modules/platform/database"

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

/** The SMTP connection to send a workspace's mail with: the one asked for, else the default, else the oldest connected one ($1 workspace, $2 connection or null). */
export const FIND_SMTP_CONNECTION = sql`SELECT id, public_meta
FROM public.connections
WHERE workspace_id = $1::uuid AND provider = 'smtp' AND status = 'connected' AND ($2::uuid IS NULL OR id = $2::uuid)
ORDER BY is_default DESC, created_at
LIMIT 1`
