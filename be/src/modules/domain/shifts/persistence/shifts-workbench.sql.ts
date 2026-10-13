import { sql } from "@modules/platform/database"

/** Reads every version of one week of a workspace, newest first ($1 workspace, $2 Monday). */
export const SELECT_WEEK_SCHEDULES = sql`SELECT id, week_start, version, status, source, cost_vnd, explanation, solver_ms, summary, evidence, work_item_id, created_at, published_at
FROM public.shifts_schedules
WHERE workspace_id = $1 AND week_start = $2::date
ORDER BY version DESC
LIMIT 20`

/** Reads the leave requests of a workspace, newest first; pass a person to read only theirs ($1 workspace, $2 person or null). */
export const SELECT_LEAVES = sql`SELECT id, staff_id, from_date, to_date, reason, status, work_item_id, created_at
FROM public.shifts_leave_requests
WHERE workspace_id = $1 AND ($2::uuid IS NULL OR staff_id = $2::uuid)
ORDER BY created_at DESC
LIMIT 200`

/** Reads the swap and claim requests of a workspace, newest first; pass a person to read only theirs ($1 workspace, $2 person or null). */
export const SELECT_SWAPS = sql`SELECT id, kind, shift_id, from_staff_id, to_staff_id, reason, status, checks, work_item_id, created_at
FROM public.shifts_swap_requests
WHERE workspace_id = $1 AND ($2::uuid IS NULL OR from_staff_id = $2::uuid OR to_staff_id = $2::uuid)
ORDER BY created_at DESC
LIMIT 200`

/** Reads every availability statement of a workspace, newest first; pass a person to read only theirs ($1 workspace, $2 person or null). */
export const SELECT_ALL_AVAILABILITY = sql`SELECT id, staff_id, weekday, shift_date, start_time, end_time, available, note, status, created_at
FROM public.shifts_availability
WHERE workspace_id = $1 AND ($2::uuid IS NULL OR staff_id = $2::uuid)
ORDER BY created_at DESC
LIMIT 500`

/** Reads the decision rows of a set of ids ($1 ids). */
export const SELECT_WORK_ITEMS = sql`SELECT id, status, proposal, result, decided_path
FROM public.work_items
WHERE id = ANY($1::uuid[])
LIMIT 200`

/** Reads the check-ins of a set of shifts ($1 workspace, $2 shift ids). */
export const SELECT_ATTENDANCE = sql`SELECT shift_id, checked_in_at
FROM public.shifts_attendance
WHERE workspace_id = $1 AND shift_id = ANY($2::uuid[])
LIMIT 2000`

/** Reads the shifts profile of a member: linked directly by account, or through the member's staff row ($1 workspace, $2 user, $3 member staff row or null). */
export const SELECT_PROFILE_OF_MEMBER = sql`SELECT id FROM public.shifts_staff
WHERE workspace_id = $1 AND active AND (user_id = $2::uuid OR ($3::uuid IS NOT NULL AND staff_id = $3::uuid))
ORDER BY created_at
LIMIT 1`

/** Reads the active shop staff rows of a workspace ($1 workspace). */
export const SELECT_SHOP_STAFF = sql`SELECT id, name
FROM public.staff
WHERE workspace_id = $1 AND active
ORDER BY created_at
LIMIT 500`

/** Reads whether the shift reminder pipeline is on ($1 workspace). */
export const SELECT_REMINDER_ON = sql`SELECT enabled
FROM public.automation_pipelines
WHERE workspace_id = $1 AND template_key = 'shifts_shift_reminder'
LIMIT 1`

/** Reads the shifts of a set of ids, for the swap request lines ($1 workspace, $2 shift ids). */
export const SELECT_SHIFTS_BY_IDS = sql`SELECT id, shift_date, start_time, end_time, position_id, staff_id, status
FROM public.shifts_shifts
WHERE workspace_id = $1 AND id = ANY($2::uuid[])
LIMIT 500`

/** Reads the published or swapped shifts of a range of days ($1 workspace, $2 first day, $3 last day). */
export const SELECT_POSTED_SHIFTS = sql`SELECT id, schedule_id, shift_date, start_time, end_time, position_id, staff_id, status
FROM public.shifts_shifts
WHERE workspace_id = $1 AND shift_date BETWEEN $2::date AND $3::date AND status IN ('published', 'swapped')
ORDER BY shift_date, start_time
LIMIT 2000`

/** Counts the open published shifts of a range of days ($1 workspace, $2 first day, $3 last day). */
export const COUNT_OPEN_GAPS = sql`SELECT count(*)::int AS n
FROM public.shifts_shifts
WHERE workspace_id = $1 AND status = 'published' AND staff_id IS NULL AND shift_date BETWEEN $2::date AND $3::date`

/** Counts the leave requests waiting for the manager ($1 workspace). */
export const COUNT_PENDING_LEAVES = sql`SELECT count(*)::int AS n
FROM public.shifts_leave_requests
WHERE workspace_id = $1 AND status = 'pending'`

/** Sums the scheduled minutes of staffed published shifts of a range of days ($1 workspace, $2 first day, $3 day after the last). */
export const SUM_MONTH_MINUTES = sql`SELECT coalesce(sum(extract(epoch from (end_time - start_time)) / 60), 0)::int AS minutes
FROM public.shifts_shifts
WHERE workspace_id = $1 AND status IN ('published', 'swapped') AND staff_id IS NOT NULL AND shift_date >= $2::date AND shift_date < $3::date`

/** Makes or renames a position; answers its id ($1 workspace, $2 position or null, $3 name, $4 colour or null). */
export const SAVE_POSITION = sql`SELECT public.shifts_save_position($1::uuid, $2::uuid, $3, $4) AS id`

/** Retires a position ($1 workspace, $2 position). */
export const REMOVE_POSITION = sql`SELECT public.shifts_remove_position($1::uuid, $2::uuid)`

/** Makes or updates a shifts profile; answers its id ($1 workspace, $2 profile or null, $3 row json). */
export const SAVE_STAFF_PROFILE = sql`SELECT public.shifts_save_staff($1::uuid, $2::uuid, $3::jsonb) AS id`

/** Saves the hourly wage of a person ($1 workspace, $2 shifts profile, $3 wage). */
export const UPSERT_PAY = sql`SELECT public.shifts_save_pay($1::uuid, $2::uuid, $3)`

/** Updates one coverage block, or inserts one per weekday when the id is null ($1 workspace, $2 block or null, $3 weekdays, $4 start, $5 end, $6 position, $7 min, $8 ideal, $9 peak). */
export const SAVE_COVERAGE = sql`SELECT public.shifts_save_coverage($1::uuid, $2::uuid, $3::smallint[], $4::time, $5::time, $6::uuid, $7, $8, $9)`

/** Removes a coverage block ($1 workspace, $2 block). */
export const REMOVE_COVERAGE = sql`SELECT public.shifts_remove_coverage($1::uuid, $2::uuid)`

/** Saves the rules of a workspace ($1 workspace, $2 opening hours json, $3 swap notice, $4 leave notice, $5 remind, $6 no-show, $7 overtime). */
export const UPSERT_SETTINGS = sql`SELECT public.shifts_save_settings($1::uuid, $2::jsonb, $3, $4, $5, $6, $7)`

/** Adds an availability statement; answers its id ($1 workspace, $2 person, $3 weekday or null, $4 date or null, $5 start, $6 end, $7 available, $8 note, $9 status, $10 decider or null). */
export const INSERT_AVAILABILITY = sql`SELECT public.shifts_add_availability($1::uuid, $2::uuid, $3::smallint, $4::date, $5::time, $6::time, $7, $8, $9, $10) AS id`

/** Removes an availability statement ($1 workspace, $2 statement). */
export const REMOVE_AVAILABILITY = sql`SELECT public.shifts_remove_availability($1::uuid, $2::uuid)`

/** Decides a pending availability statement ($1 workspace, $2 statement, $3 status, $4 decider). */
export const DECIDE_AVAILABILITY = sql`SELECT public.shifts_decide_availability($1::uuid, $2::uuid, $3, $4)`

/** Records a check-in once and answers when it happened; a second check-in answers the first time ($1 workspace, $2 shift, $3 person). */
export const CHECK_IN = sql`SELECT public.shifts_check_in($1::uuid, $2::uuid, $3::uuid) AS checked_in_at`
