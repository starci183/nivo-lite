import { sql } from "@modules/platform/database"

/**
 * Remembers one delivery of a SePay connection. The workspace and environment come from the connection itself, so an unknown
 * connection id records nothing. A repeat of an accepted transaction id is stored as `duplicate`
 * ($1 connection id, $2 outcome, $3 kind, $4 amount or null, $5 SePay transaction id or null).
 */
export const INSERT_SEPAY_EVENT = sql`INSERT INTO public.channel_connections_sepay_events
    (workspace_id, connection_id, environment, outcome, kind, amount_vnd, provider_event_id)
SELECT c.workspace_id, c.id, c.environment,
    CASE WHEN $2::text = 'accepted' AND $5::text IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.channel_connections_sepay_events e
        WHERE e.connection_id = c.id AND e.outcome = 'accepted' AND e.provider_event_id = $5::text
    ) THEN 'duplicate' ELSE $2::text END,
    $3::text, $4::bigint, $5::text
FROM public.connections c
WHERE c.id = $1 AND c.provider = 'sepay'`

/** The newest deliveries of a connection ($1 workspace id, $2 connection id, $3 limit). */
export const LIST_SEPAY_EVENTS = sql`SELECT id, to_char(received_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at, outcome, kind, amount_vnd, provider_event_id, environment
FROM public.channel_connections_sepay_events
WHERE workspace_id = $1 AND connection_id = $2
ORDER BY received_at DESC
LIMIT $3`

/** The health counters of a connection ($1 workspace id, $2 connection id). */
export const SELECT_SEPAY_STATS = sql`SELECT
    to_char(max(received_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_at,
    to_char(max(received_at) FILTER (WHERE kind = 'ping' AND outcome <> 'unauthorized') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS ping_at,
    to_char(max(received_at) FILTER (WHERE kind IN ('credit', 'debit') AND outcome <> 'unauthorized') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS transaction_at,
    count(*) FILTER (WHERE received_at > now() - interval '24 hours') AS total_24h,
    count(*) FILTER (WHERE received_at > now() - interval '24 hours' AND outcome <> 'unauthorized') AS valid_24h,
    count(*) FILTER (WHERE received_at > now() - interval '24 hours' AND outcome = 'duplicate') AS duplicate_24h
FROM public.channel_connections_sepay_events
WHERE workspace_id = $1 AND connection_id = $2
LIMIT 1`
