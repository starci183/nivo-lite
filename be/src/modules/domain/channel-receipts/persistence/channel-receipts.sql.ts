import { sql } from "@modules/platform/database"

/** Whether a holding line already went out in this conversation since a moment ($1 workspace, $2 receipt prefix, $3 since). */
export const FIND_RECENT_HOLDING = sql`SELECT receipt_id
FROM public.channel_receipts
WHERE workspace_id = $1 AND channel = 'holding' AND receipt_id LIKE $2 AND created_at >= $3
LIMIT 1`

/** Remembers that a holding line went out ($1 workspace, $2 receipt id). */
export const INSERT_HOLDING_RECEIPT = sql`INSERT INTO public.channel_receipts (workspace_id, channel, receipt_id)
VALUES ($1, 'holding', $2)`
