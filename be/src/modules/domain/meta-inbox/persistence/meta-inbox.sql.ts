import { sql } from "@modules/platform/database"

/** Claims one Meta delivery and returns its inbox identity only to the winning transaction. */
export const INSERT_META_INBOX = sql`INSERT INTO public.meta_inbox (provider, delivery_id, payload)
VALUES ($1, $2, $3::jsonb)
ON CONFLICT (provider, delivery_id) DO NOTHING
RETURNING id`

/** Marks the claimed delivery complete before the same transaction commits. */
export const COMPLETE_META_INBOX = sql`WITH completed AS (
    UPDATE public.meta_inbox
    SET processed_at = now()
    WHERE id = $1
    RETURNING id
)
SELECT id FROM completed`

/** The person wrote to the Page: the 24 hour window opens (or moves forward) at the given instant, never backwards. */
export const TOUCH_META_THREAD = sql`INSERT INTO public.meta_threads (connection_id, platform, user_id, last_user_at)
VALUES ($1, $2, $3, $4::timestamptz)
ON CONFLICT (connection_id, platform, user_id) DO UPDATE
SET last_user_at = GREATEST(public.meta_threads.last_user_at, excluded.last_user_at)`

/** A comment arrived: remember its time once; an answered comment is never reset. */
export const NOTE_META_COMMENT = sql`INSERT INTO public.meta_comments (connection_id, comment_id, platform, comment_at)
VALUES ($1, $2, $3, $4::timestamptz)
ON CONFLICT (connection_id, comment_id) DO NOTHING`
