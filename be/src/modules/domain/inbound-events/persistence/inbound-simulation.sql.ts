import { sql } from "@modules/platform/database"

/** Counts a repeated simulated event; a simulator can never alter a live event that happens to share its key ($1 workspace, $2 key, $3 instant). */
export const BUMP_SIMULATION_DUPLICATE = sql`WITH bumped AS (
    UPDATE public.inbound_events
    SET duplicate_count = duplicate_count + 1, last_duplicate_at = $3
    WHERE workspace_id = $1::uuid AND dedupe_key = $2 AND origin = 'simulated'
    RETURNING id
)
SELECT id FROM bumped`
