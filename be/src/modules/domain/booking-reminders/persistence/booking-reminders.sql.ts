import { sql } from "@modules/platform/database"

/** The reminder offsets the owner customised on the appointment reminder card ($1 workspace). */
export const SELECT_REMINDER_CARD = sql`SELECT config
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
