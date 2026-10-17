import { sql } from "@modules/platform/database"

/** Atomically claims a delivery for event writers that do not have a provider-specific receipt table. */
export const INSERT_INBOX_CLAIM = sql`INSERT INTO public.inbox (source, delivery_id)
VALUES ($1, $2)
ON CONFLICT (source, delivery_id) DO NOTHING
RETURNING delivery_id`
