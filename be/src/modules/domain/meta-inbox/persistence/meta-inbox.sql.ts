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
