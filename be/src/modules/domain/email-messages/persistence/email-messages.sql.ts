import { sql } from "@modules/platform/database"

/** Writes down one send attempt ($1 workspace, $2 connection or null, $3 recipient, $4 subject, $5 purpose, $6 status, $7 via, $8 provider message id, $9 error, $10 refs json). */
export const INSERT_EMAIL_MESSAGE = sql`INSERT INTO public.email_messages (workspace_id, connection_id, to_address, subject, purpose, status, via, provider_message_id, error, refs)
VALUES ($1::uuid, $2::uuid, left($3, 254), left($4, 300), left($5, 60), $6, $7, $8, left($9, 600), $10::jsonb)
RETURNING id`

/** How many messages the workspace sent since a time, optionally only through one sender ($1 workspace, $2 since, $3 via or null). */
export const COUNT_SENT_EMAILS = sql`SELECT count(*)::int AS n
FROM public.email_messages
WHERE workspace_id = $1::uuid AND status = 'sent' AND created_at >= $2::timestamptz AND ($3::text IS NULL OR via = $3::text)`
