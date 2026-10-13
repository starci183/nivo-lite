import { sql } from "@modules/platform/database"

/** Lists a bounded workspace feed, newest first with a deterministic tie break ($1 workspace, $2 limit). */
export const LIST_INBOUND_EVENTS = sql`SELECT id, workspace_id, channel, kind, origin, sender_name, sender_contact, body,
amount_vnd::float8 AS amount_vnd, external_ref, event_id, lead_id, status, duplicate_count,
to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
FROM public.inbound_events
WHERE workspace_id = $1::uuid
ORDER BY created_at DESC, id DESC
LIMIT $2::int`

/**
 * Records one bank credit as an inbound payment event, once per workspace and event key: a repeat answers no row
 * ($1 workspace, $2 origin, $3 payer, $4 text, $5 amount, $6 transfer content, $7 event id, $8 dedupe key).
 */
export const INSERT_BANK_EVENT = sql`INSERT INTO public.inbound_events (workspace_id, channel, kind, origin, sender_name, body, amount_vnd, external_ref, event_id, dedupe_key)
VALUES ($1, 'bank', 'payment', $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (workspace_id, dedupe_key) DO NOTHING
RETURNING id`

/** Counts a repeated credit on the event it repeats ($1 workspace, $2 dedupe key, $3 instant). */
export const BUMP_DUPLICATE_EVENT = sql`WITH bumped AS (
    UPDATE public.inbound_events
    SET duplicate_count = duplicate_count + 1, last_duplicate_at = $3
    WHERE workspace_id = $1 AND dedupe_key = $2
    RETURNING id
)
SELECT id FROM bumped`

/** Holds a received inbound event for the owner's check; an event past that stage is left as it is ($1 event id). */
export const HOLD_EVENT_FOR_OWNER = sql`WITH held AS (
    UPDATE public.inbound_events
    SET status = 'needs_decision'
    WHERE id = $1 AND status = 'received'
    RETURNING id
)
SELECT id FROM held`

/** Keeps a message nobody is bound to answer visible in the inbox, once per dedupe key ($1 workspace, $2 channel, $3 sender, $4 body, $5 event id, $6 dedupe key). */
export const INSERT_UNROUTED_EVENT = sql`INSERT INTO public.inbound_events (workspace_id, channel, kind, origin, sender_name, body, event_id, dedupe_key)
VALUES ($1, $2, 'message', 'live', $3, $4, $5, $6)
ON CONFLICT (workspace_id, dedupe_key) DO NOTHING`

/** One inbound event of the workspace ($1 workspace, $2 event). */
export const FIND_INBOUND_EVENT = sql`SELECT id, workspace_id, channel, kind, origin, sender_name, sender_contact, body, amount_vnd::float8 AS amount_vnd, external_ref, event_id, lead_id, status
FROM public.inbound_events
WHERE workspace_id = $1::uuid AND id = $2::uuid
LIMIT 1`

/** Sets where an inbound event stands and links the customer the engine found ($1 workspace, $2 event, $3 status or null to keep it, $4 lead or null to keep it). */
export const MARK_INBOUND_EVENT = sql`UPDATE public.inbound_events
SET status = COALESCE($3::text, status), lead_id = COALESCE($4::uuid, lead_id)
WHERE workspace_id = $1::uuid AND id = $2::uuid`

/** Records an input of a channel once per dedupe key; a repeat answers no row ($1 workspace, $2 channel, $3 kind, $4 origin, $5 sender, $6 contact, $7 text, $8 amount, $9 external ref, $10 event id, $11 dedupe key). */
export const INSERT_INPUT_EVENT = sql`INSERT INTO public.inbound_events (workspace_id, channel, kind, origin, sender_name, sender_contact, body, amount_vnd, external_ref, event_id, dedupe_key)
VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::bigint, $9, $10, $11)
ON CONFLICT (workspace_id, dedupe_key) DO NOTHING
RETURNING id`

/** Hands a finished sale to the order chain as an inbound order, once per sale ($1 workspace, $2 origin, $3 customer, $4 contact, $5 body, $6 amount, $7 sale ref, $8 lead or null); answers a row only when it was new. */
export const INSERT_ORDER_HANDOFF = sql`WITH created AS (
    INSERT INTO public.inbound_events (workspace_id, channel, kind, origin, sender_name, sender_contact, body, amount_vnd, external_ref, dedupe_key, lead_id)
    VALUES ($1, 'manual', 'order', $2, $3, $4, $5, $6, $7, 'order:' || $7, $8)
    ON CONFLICT (workspace_id, dedupe_key) DO NOTHING
    RETURNING id
)
SELECT id FROM created`
