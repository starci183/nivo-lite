import { sql } from "@modules/platform/database"

/** The person wrote to the Page: the 24 hour window opens (or moves forward) at the given instant, never backwards. */
export const TOUCH_META_THREAD = sql`INSERT INTO public.meta_threads (connection_id, platform, user_id, last_user_at)
VALUES ($1, $2, $3, $4::timestamptz)
ON CONFLICT (connection_id, platform, user_id) DO UPDATE
SET last_user_at = GREATEST(public.meta_threads.last_user_at, excluded.last_user_at)`
