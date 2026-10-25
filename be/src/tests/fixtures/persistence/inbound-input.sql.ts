import { sql } from "@modules/platform/database"

/** The durable input behind an inbox claim ($1 workspace, $2 domain key). */
export const INPUT_EVENT = sql`SELECT id, event_id FROM public.inbound_events
WHERE workspace_id = $1::uuid AND dedupe_key = $2`
