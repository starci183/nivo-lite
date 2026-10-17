import { sql } from "@modules/platform/database"

/** Claims one Meta delivery and returns its inbox identity only to the winning transaction. */
export const INSERT_META_INBOX = sql`INSERT INTO public.meta_inbox (provider, delivery_id, payload)
VALUES ($1, $2, $3::jsonb)
ON CONFLICT (provider, delivery_id) DO NOTHING
RETURNING id`

/** Marks the claimed delivery complete in the deferred consumer transaction. */
export const COMPLETE_META_INBOX = sql`WITH completed AS (
    UPDATE public.meta_inbox
    SET processed_at = now()
    WHERE id = $1
    RETURNING id
)
SELECT id FROM completed`

/** Locks one pending receipt; concurrent jobs and completed replays cannot repeat its effects. */
export const FIND_PENDING_META_INBOX = sql`SELECT id, payload FROM public.meta_inbox
WHERE provider = 'meta' AND delivery_id = $1 AND processed_at IS NULL
LIMIT 1
FOR UPDATE`
