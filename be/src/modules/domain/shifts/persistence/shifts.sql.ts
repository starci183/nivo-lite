import { sql } from "@modules/platform/database"

/** Reads the active positions of a workspace ($1 workspace). */
export const SELECT_POSITIONS = sql`SELECT id, name, color FROM public.shifts_positions
WHERE workspace_id = $1 AND active
ORDER BY sort_order, created_at
LIMIT 200`

/** Reads every person ever added to the shifts of a workspace ($1 workspace). */
export const SELECT_STAFF = sql`SELECT id, name, staff_id, phone, telegram_chat_id, zalo_user_id, position_ids, skills, max_hours_week, max_hours_day, min_rest_hours, active
FROM public.shifts_staff
WHERE workspace_id = $1
ORDER BY created_at
LIMIT 500`

/** Reads the hourly wages of a workspace ($1 workspace). */
export const SELECT_PAY = sql`SELECT staff_id, hourly_wage_vnd FROM public.shifts_staff_pay WHERE workspace_id = $1 LIMIT 500`

/** Reads the coverage blocks of a workspace ($1 workspace). */
export const SELECT_COVERAGE = sql`SELECT id, weekday, start_time, end_time, position_id, min_staff, ideal_staff, is_peak
FROM public.shifts_coverage
WHERE workspace_id = $1
ORDER BY weekday, start_time
LIMIT 1000`

/** Reads the rules of a workspace ($1 workspace). */
export const SELECT_SETTINGS = sql`SELECT opening_hours, swap_notice_hours, leave_notice_days, remind_minutes, noshow_minutes, overtime_hours_week
FROM public.shifts_settings
WHERE workspace_id = $1
LIMIT 1`

/** Reads the approved availability statements of a workspace ($1 workspace). */
export const SELECT_AVAILABILITY = sql`SELECT staff_id, weekday, shift_date, start_time, end_time, available
FROM public.shifts_availability
WHERE workspace_id = $1 AND status = 'approved'
LIMIT 2000`

/** Reads the approved leave that touches a range of days ($1 workspace, $2 first day, $3 last day). */
export const SELECT_APPROVED_LEAVES = sql`SELECT id, staff_id, from_date, to_date, reason, status
FROM public.shifts_leave_requests
WHERE workspace_id = $1 AND status = 'approved' AND to_date >= $2::date AND from_date <= $3::date
LIMIT 500`

/** Reads one leave request ($1 workspace, $2 request). */
export const SELECT_LEAVE = sql`SELECT id, staff_id, from_date, to_date, reason, status
FROM public.shifts_leave_requests
WHERE workspace_id = $1 AND id = $2::uuid
LIMIT 1`

/** Reads one swap or claim request ($1 workspace, $2 request). */
export const SELECT_SWAP = sql`SELECT id, kind, shift_id, from_staff_id, to_staff_id, status
FROM public.shifts_swap_requests
WHERE workspace_id = $1 AND id = $2::uuid
LIMIT 1`

/** Reads one schedule ($1 workspace, $2 schedule). */
export const SELECT_SCHEDULE = sql`SELECT id, week_start, version, status, cost_vnd, summary, evidence
FROM public.shifts_schedules
WHERE workspace_id = $1 AND id = $2::uuid
LIMIT 1`

/** Reads the shifts of a schedule that were not cancelled, with the state of the schedule ($1 workspace, $2 schedule). */
export const SELECT_SCHEDULE_SHIFTS = sql`SELECT s.id, s.schedule_id, s.shift_date, s.start_time, s.end_time, s.position_id, s.staff_id, s.status, c.status AS schedule_status, c.week_start
FROM public.shifts_shifts s
JOIN public.shifts_schedules c ON c.id = s.schedule_id
WHERE s.workspace_id = $1 AND s.schedule_id = $2::uuid AND s.status <> 'cancelled'
ORDER BY s.shift_date, s.start_time
LIMIT 1000`

/** Reads one shift with the state of its schedule ($1 workspace, $2 shift). */
export const SELECT_SHIFT = sql`SELECT s.id, s.schedule_id, s.shift_date, s.start_time, s.end_time, s.position_id, s.staff_id, s.status, c.status AS schedule_status, c.week_start
FROM public.shifts_shifts s
JOIN public.shifts_schedules c ON c.id = s.schedule_id
WHERE s.workspace_id = $1 AND s.id = $2::uuid
LIMIT 1`

/** Reads the published or swapped work of one day, to carry the rest rule over the week boundary ($1 workspace, $2 day). */
export const SELECT_PRIOR_SHIFTS = sql`SELECT s.id, s.schedule_id, s.shift_date, s.start_time, s.end_time, s.position_id, s.staff_id, s.status, c.status AS schedule_status, c.week_start
FROM public.shifts_shifts s
JOIN public.shifts_schedules c ON c.id = s.schedule_id
WHERE s.workspace_id = $1 AND s.shift_date = $2::date AND s.status IN ('published', 'swapped') AND s.staff_id IS NOT NULL
LIMIT 500`

/** Reads the shifts a person works in a range of days ($1 workspace, $2 person, $3 first day, $4 last day, $5 statuses). */
export const SELECT_STAFF_SHIFTS = sql`SELECT s.id, s.schedule_id, s.shift_date, s.start_time, s.end_time, s.position_id, s.staff_id, s.status, c.status AS schedule_status, c.week_start
FROM public.shifts_shifts s
JOIN public.shifts_schedules c ON c.id = s.schedule_id
WHERE s.workspace_id = $1 AND s.staff_id = $2::uuid AND s.shift_date BETWEEN $3::date AND $4::date AND s.status = ANY($5::text[])
LIMIT 500`

/** Reads everyone's assigned shifts of a range of days ($1 workspace, $2 first day, $3 last day, $4 statuses). */
export const SELECT_RANGE_SHIFTS = sql`SELECT s.id, s.schedule_id, s.shift_date, s.start_time, s.end_time, s.position_id, s.staff_id, s.status, c.status AS schedule_status, c.week_start
FROM public.shifts_shifts s
JOIN public.shifts_schedules c ON c.id = s.schedule_id
WHERE s.workspace_id = $1 AND s.shift_date BETWEEN $2::date AND $3::date AND s.status = ANY($4::text[]) AND s.staff_id IS NOT NULL
LIMIT 2000`

/** Reads the shifts of a published schedule ($1 workspace, $2 schedule). */
export const SELECT_PUBLISHED_SHIFTS = sql`SELECT s.id, s.schedule_id, s.shift_date, s.start_time, s.end_time, s.position_id, s.staff_id, s.status, c.status AS schedule_status, c.week_start
FROM public.shifts_shifts s
JOIN public.shifts_schedules c ON c.id = s.schedule_id
WHERE s.workspace_id = $1 AND s.schedule_id = $2::uuid AND s.status = 'published'
ORDER BY s.shift_date, s.start_time
LIMIT 1000`

/** Reads the staff profile of one member ($1 workspace, $2 user). */
export const SELECT_PROFILE_OF_USER = sql`SELECT id FROM public.shifts_staff
WHERE workspace_id = $1 AND active AND user_id = $2::uuid
ORDER BY created_at
LIMIT 1`

/** Counts the earlier asks of one dedupe prefix so a repeated ask gets a fresh key ($1 workspace, $2 action, $3 key prefix). */
export const COUNT_WORK_ASKS = sql`SELECT count(*)::int AS attempts FROM public.work_items
WHERE workspace_id = $1 AND action = $2 AND dedupe_key LIKE $3
LIMIT 1`

/** Saves a new draft version of a week and answers its id ($1 workspace, $2 week, $3 cost, $4 summary json, $5 evidence json, $6 solver ms, $7 by). */
export const SAVE_SCHEDULE = sql`SELECT public.shifts_save_schedule($1::uuid, $2::date, $3::bigint, $4::jsonb, $5::jsonb, $6::int, $7::text) AS id`

/** Adds shifts to a schedule from parallel arrays ($1 workspace, $2 schedule, $3 days, $4 starts, $5 ends, $6 positions, $7 people, $8 source). */
export const ADD_SHIFTS = sql`SELECT public.shifts_add_shifts($1::uuid, $2::uuid, $3::date[], $4::time[], $5::time[], $6::uuid[], $7::uuid[], $8::text) AS added`

/** Stores the explanation of a schedule ($1 workspace, $2 schedule, $3 text, $4 evidence json). */
export const SET_EXPLANATION = sql`SELECT public.shifts_set_explanation($1::uuid, $2::uuid, $3::text, $4::jsonb)`

/** Gives a draft shift to another person or opens it ($1 workspace, $2 shift, $3 person or null). */
export const REASSIGN_SHIFT = sql`SELECT public.shifts_reassign($1::uuid, $2::uuid, $3::uuid)`

/** Removes a draft shift ($1 workspace, $2 shift). */
export const REMOVE_SHIFT = sql`SELECT public.shifts_remove_shift($1::uuid, $2::uuid)`

/** Links a schedule to the decision about publishing it ($1 workspace, $2 schedule, $3 work item). */
export const LINK_SCHEDULE = sql`SELECT public.shifts_link_schedule($1::uuid, $2::uuid, $3::uuid)`

/** Publishes a draft schedule and answers the shifts now published ($1 workspace, $2 schedule, $3 evidence json, $4 work item). */
export const PUBLISH_SCHEDULE = sql`SELECT public.shifts_publish($1::uuid, $2::uuid, $3::jsonb, $4::uuid) AS published`

/** Records a leave request and answers its id ($1 workspace, $2 person, $3 first day, $4 last day, $5 reason). */
export const CREATE_LEAVE = sql`SELECT public.shifts_create_leave($1::uuid, $2::uuid, $3::date, $4::date, $5::text) AS id`

/** Records a swap or claim request and answers its id ($1 workspace, $2 kind, $3 shift, $4 offering person or null, $5 taking person, $6 reason). */
export const CREATE_SWAP = sql`SELECT public.shifts_create_swap($1::uuid, $2::text, $3::uuid, $4::uuid, $5::uuid, $6::text) AS id`

/** Links a swap request to its findings and decision ($1 workspace, $2 request, $3 findings json, $4 work item). */
export const LINK_SWAP = sql`SELECT public.shifts_link_swap($1::uuid, $2::uuid, $3::jsonb, $4::uuid)`

/** Links a leave request to its decision ($1 workspace, $2 request, $3 work item). */
export const LINK_LEAVE = sql`SELECT public.shifts_link_leave($1::uuid, $2::uuid, $3::uuid)`

/** Settles a swap request once and moves the shift when approved; answers whether it was still pending ($1 workspace, $2 request, $3 status, $4 by, $5 findings json, $6 work item). */
export const DECIDE_SWAP = sql`SELECT public.shifts_decide_swap($1::uuid, $2::uuid, $3::text, $4::text, $5::jsonb, $6::uuid) AS settled`

/** Settles a leave request once and opens the shifts it hits when approved; answers those shifts ($1 workspace, $2 request, $3 status, $4 by, $5 work item, $6 note). */
export const DECIDE_LEAVE = sql`SELECT public.shifts_decide_leave($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid, $6::text) AS opened`

/** Applies the quick import ($1 workspace, $2 positions json, $3 people json, $4 coverage json). */
export const APPLY_IMPORT = sql`SELECT public.shifts_import_apply($1::uuid, $2::jsonb, $3::jsonb, $4::jsonb) AS counts`
