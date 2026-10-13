import { sql } from "@modules/platform/database"

/** The delivery record of the Zalo webhook: one row per delivery id ($1 provider, $2 delivery id, $3 payload). */
export const INSERT_ZALO_INBOX = sql`INSERT INTO public.zalo_inbox (provider, delivery_id, payload)
VALUES ($1, $2, $3::jsonb)
ON CONFLICT (provider, delivery_id) DO NOTHING
RETURNING id`

/** Marks a claimed Zalo delivery processed before its transaction commits ($1 inbox id). */
export const COMPLETE_ZALO_INBOX = sql`WITH completed AS (
    UPDATE public.zalo_inbox
    SET processed_at = now()
    WHERE id = $1
    RETURNING id
)
SELECT id FROM completed`
