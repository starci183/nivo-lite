import { sql } from "@modules/platform/database"

/** Cancels an owned waitlist entry while preserving its history ($1 workspace, $2 entry). */
export const CANCEL_SETUP_WAITLIST = sql`WITH changed AS (UPDATE public.booking_waitlist SET status = 'cancelled'
WHERE workspace_id = $1 AND id = $2 RETURNING id) SELECT id FROM changed LIMIT 1`
