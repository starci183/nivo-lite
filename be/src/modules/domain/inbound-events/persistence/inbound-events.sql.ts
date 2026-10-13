import { sql } from "@modules/platform/database"

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
