import { sql } from "@modules/platform/database"

/** The reminder offsets the owner customised on the appointment reminder card ($1 workspace). */
export const SELECT_REMINDER_CARD = sql`SELECT config, body
FROM public.automation_pipelines
WHERE workspace_id = $1 AND template_key = 'appointment_reminder' AND enabled
LIMIT 1`

/** Writes or resets the reminders of a booking, one per offset ($1 workspace, $2 booking, $3 kinds, $4 due instants). */
export const UPSERT_REMINDERS = sql`INSERT INTO public.booking_reminders (workspace_id, booking_id, kind, due_at, status)
SELECT $1, $2, t.kind, t.due_at, 'scheduled'
FROM unnest($3::text[], $4::timestamptz[]) AS t(kind, due_at)
ON CONFLICT (booking_id, kind) DO UPDATE SET due_at = EXCLUDED.due_at, status = 'scheduled', work_item_id = NULL, sent_at = NULL, note = ''`

/** Cancels the scheduled reminders of a booking that are already due ($1 booking, $2 now, $3 note). */
export const CANCEL_STALE_REMINDERS = sql`UPDATE public.booking_reminders
SET status = 'cancelled', note = $3
WHERE booking_id = $1 AND status = 'scheduled' AND due_at <= $2::timestamptz`

/** Cancels every reminder of a booking that has not been sent ($1 booking, $2 note). */
export const CANCEL_OPEN_REMINDERS = sql`UPDATE public.booking_reminders
SET status = 'cancelled', note = $2
WHERE booking_id = $1 AND status IN ('scheduled', 'waiting')`

/** Takes the reminders that are due, once: a scheduled row turns `waiting` and is returned to the one tick that took it ($1 now, $2 limit, $3 note). */
export const CLAIM_DUE_REMINDERS = sql`WITH due AS (
    SELECT id FROM public.booking_reminders
    WHERE status = 'scheduled' AND due_at <= $1::timestamptz
    ORDER BY due_at
    LIMIT $2::int
    FOR UPDATE SKIP LOCKED
)
UPDATE public.booking_reminders r
SET status = 'waiting', note = $3
FROM due
WHERE r.id = due.id
RETURNING r.id, r.workspace_id, r.booking_id, r.kind, (extract(epoch FROM r.due_at) * 1000)::float8 AS due_ms`

/** Writes where a taken reminder ended ($1 reminder, $2 status, $3 work item or null, $4 sent instant or null, $5 note). */
export const SETTLE_REMINDER = sql`UPDATE public.booking_reminders
SET status = $2, work_item_id = $3::uuid, sent_at = $4::timestamptz, note = $5
WHERE id = $1::uuid`
