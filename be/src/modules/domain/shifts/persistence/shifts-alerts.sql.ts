import { sql } from "@modules/platform/database"

/** One person of the shifts with the channels they are linked to ($1 workspace, $2 shifts profile). */
export const SELECT_NOTIFY_PERSON = sql`SELECT id, name, staff_id, telegram_chat_id, zalo_user_id
FROM public.shifts_staff
WHERE workspace_id = $1 AND id = $2::uuid
LIMIT 1`

/** The active staff rows the Office handles are made from, oldest first ($1 workspace). */
export const SELECT_HANDLE_STAFF = sql`SELECT id, name FROM public.staff
WHERE workspace_id = $1 AND active
ORDER BY created_at, id
LIMIT 500`

/** The handles of the workspace agents, reserved in the Office ($1 workspace). */
export const SELECT_AGENT_HANDLES = sql`SELECT handle FROM public.agents WHERE workspace_id = $1 LIMIT 500`

/** The oldest active shifts agent of a workspace, the one the shift messages speak through ($1 workspace). */
export const SELECT_SHIFTS_AGENT = sql`SELECT id FROM public.agents
WHERE workspace_id = $1 AND module = 'shifts' AND status = 'active'
ORDER BY created_at
LIMIT 1`

/** Records one message of the module as evidence, sent, failed or skipped, with why ($1 workspace .. $9 error). */
export const INSERT_NOTIFICATION = sql`SELECT public.shifts_record_notice($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::text, $7::text, $8::text, $9::text)`

/** The workspaces whose shift reminders are on, with the automation settings and the module defaults. */
export const SELECT_REMINDER_WORKSPACES = sql`SELECT p.workspace_id, p.config, s.remind_minutes, s.noshow_minutes
FROM public.automation_pipelines p
LEFT JOIN public.shifts_settings s ON s.workspace_id = p.workspace_id
WHERE p.template_key = 'shifts_shift_reminder' AND p.enabled
ORDER BY p.workspace_id
LIMIT 2000`

/** Whether the shift reminders of one workspace are on ($1 workspace). */
export const SELECT_REMINDER_ON = sql`SELECT EXISTS (
    SELECT 1 FROM public.automation_pipelines
    WHERE workspace_id = $1 AND template_key = 'shifts_shift_reminder' AND enabled
) AS enabled`

/**
 * The live assigned shifts of a workspace between two days, with whether the person checked in, was reminded and was reported as a
 * no-show ($1 workspace, $2 first day, $3 last day).
 */
export const SELECT_ALERT_SHIFTS = sql`SELECT s.id, s.schedule_id, s.shift_date, s.start_time, s.end_time, s.position_id, s.staff_id, s.status,
    EXISTS (SELECT 1 FROM public.shifts_attendance a WHERE a.shift_id = s.id) AS checked_in,
    EXISTS (SELECT 1 FROM public.shifts_notifications n
            WHERE n.shift_id = s.id AND n.staff_id = s.staff_id AND n.kind = 'reminder') AS reminded,
    EXISTS (SELECT 1 FROM public.shifts_notifications n
            WHERE n.shift_id = s.id AND n.kind = 'no_show') AS alerted
FROM public.shifts_shifts s
WHERE s.workspace_id = $1 AND s.shift_date BETWEEN $2::date AND $3::date
  AND s.status IN ('published', 'swapped') AND s.staff_id IS NOT NULL
ORDER BY s.shift_date, s.start_time
LIMIT 2000`

/** One live assigned shift with its alert flags ($1 workspace, $2 shift). */
export const SELECT_ALERT_SHIFT = sql`SELECT s.id, s.schedule_id, s.shift_date, s.start_time, s.end_time, s.position_id, s.staff_id, s.status,
    EXISTS (SELECT 1 FROM public.shifts_attendance a WHERE a.shift_id = s.id) AS checked_in,
    EXISTS (SELECT 1 FROM public.shifts_notifications n
            WHERE n.shift_id = s.id AND n.staff_id = s.staff_id AND n.kind = 'reminder') AS reminded,
    EXISTS (SELECT 1 FROM public.shifts_notifications n
            WHERE n.shift_id = s.id AND n.kind = 'no_show') AS alerted
FROM public.shifts_shifts s
WHERE s.workspace_id = $1 AND s.id = $2::uuid
  AND s.status IN ('published', 'swapped') AND s.staff_id IS NOT NULL
LIMIT 1`

/** The names of the others on duty on a day ($1 workspace, $2 day, $3 the person reminded). */
export const SELECT_DAY_MATES = sql`SELECT DISTINCT p.name
FROM public.shifts_shifts s
JOIN public.shifts_staff p ON p.id = s.staff_id
WHERE s.workspace_id = $1 AND s.shift_date = $2::date AND s.status IN ('published', 'swapped')
  AND s.staff_id IS NOT NULL AND s.staff_id <> $3::uuid
ORDER BY p.name
LIMIT 5`

/** The workspaces whose monthly hours close is on, with its day and time. */
export const SELECT_MONTH_CLOSE_WORKSPACES = sql`SELECT workspace_id, config
FROM public.automation_pipelines
WHERE template_key = 'shifts_month_close' AND enabled
ORDER BY workspace_id
LIMIT 2000`

/** Whether a month was already closed ($1 workspace, $2 marker prefix like `[payroll:2026-09]%`). */
export const SELECT_PAYROLL_DONE = sql`SELECT EXISTS (
    SELECT 1 FROM public.shifts_notifications
    WHERE workspace_id = $1 AND kind = 'payroll' AND body LIKE $2
) AS done`

/** The published, assigned shifts of a month with whether the person checked in ($1 workspace, $2 first day, $3 last day). */
export const SELECT_MONTH_SHIFTS = sql`SELECT s.id, s.schedule_id, s.shift_date, s.start_time, s.end_time, s.position_id, s.staff_id, s.status,
    EXISTS (SELECT 1 FROM public.shifts_attendance a WHERE a.shift_id = s.id) AS checked_in,
    false AS reminded, false AS alerted
FROM public.shifts_shifts s
WHERE s.workspace_id = $1 AND s.shift_date BETWEEN $2::date AND $3::date
  AND s.status IN ('published', 'swapped') AND s.staff_id IS NOT NULL
ORDER BY s.shift_date, s.start_time
LIMIT 5000`

/** The oldest active owner of a workspace ($1 workspace). */
export const SELECT_OWNER = sql`SELECT user_id FROM public.workspace_members
WHERE workspace_id = $1 AND role = 'owner' AND status = 'active'
ORDER BY created_at
LIMIT 1`
