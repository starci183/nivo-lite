import { sql } from "@modules/platform/database"

/** The delivery record of the Telegram webhook: one row per delivery id, the claim that makes a redelivery a no-op ($1 provider, $2 delivery id, $3 payload). */
export const INSERT_TELEGRAM_INBOX = sql`INSERT INTO public.telegram_inbox (provider, delivery_id, payload)
VALUES ($1, $2, $3::jsonb)
ON CONFLICT (provider, delivery_id) DO NOTHING
RETURNING id`

/** Marks a claimed Telegram delivery processed in the deferred consumer transaction ($1 inbox id). */
export const COMPLETE_TELEGRAM_INBOX = sql`WITH completed AS (
    UPDATE public.telegram_inbox
    SET processed_at = now()
    WHERE id = $1
    RETURNING id
)
SELECT id FROM completed`

/** Locks one pending receipt; concurrent jobs and completed replays cannot repeat its effects. */
export const FIND_PENDING_TELEGRAM_INBOX = sql`SELECT id, payload FROM public.telegram_inbox
WHERE provider = 'telegram' AND delivery_id = $1 AND processed_at IS NULL
LIMIT 1
FOR UPDATE`
