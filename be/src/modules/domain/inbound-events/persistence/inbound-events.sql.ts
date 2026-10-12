import { sql } from "@modules/platform/database"

/** Keeps a message nobody is bound to answer visible in the inbox, once per dedupe key ($1 workspace, $2 channel, $3 sender, $4 body, $5 event id, $6 dedupe key). */
export const INSERT_UNROUTED_EVENT = sql`INSERT INTO public.inbound_events (workspace_id, channel, kind, origin, sender_name, body, event_id, dedupe_key)
VALUES ($1, $2, 'message', 'live', $3, $4, $5, $6)
ON CONFLICT (workspace_id, dedupe_key) DO NOTHING`
