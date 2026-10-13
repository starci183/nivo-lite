import { sql } from "@modules/platform/database"

/** Reads every job of a workspace, newest first ($1 workspace). */
export const SELECT_WORKBENCH_JOBS = sql`SELECT id, workspace_id, slug, title, position, employment_type, schedule, pay_min_vnd, pay_max_vnd, pay_unit,
    location, headcount, description, requirements, questions, status, channels, ad_variants, closes_at, created_at, updated_at
FROM public.hiring_jobs
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT 500`

/** Reads the newest candidates of a workspace ($1 workspace). */
export const SELECT_WORKBENCH_CANDIDATES = sql`SELECT id, workspace_id, job_id, name, phone, email, source, conversation_id, cv_path, cv_name, cv_mime, cv_size,
    answers, availability, score, score_label, score_reasons, score_summary, screened_at, stage, stage_changed_at, rejected_reason, notes, staff_id, created_at
FROM public.hiring_candidates
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT 1000`

/** Reads the newest interviews of a workspace ($1 workspace). */
export const SELECT_WORKBENCH_INTERVIEWS = sql`SELECT id, workspace_id, candidate_id, job_id, interviewer_user_id, interviewer_name, mode, location, duration_min,
    proposed_slots, slot_start, slot_end, status, token, work_item_id, reminder_sent_at, note, created_at
FROM public.hiring_interviews
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT 300`

/** Reads the newest offers of a workspace ($1 workspace). */
export const SELECT_WORKBENCH_OFFERS = sql`SELECT id, workspace_id, candidate_id, job_id, terms, draft, status, token, work_item_id, sent_via, sent_at, expires_at, responded_at, created_at
FROM public.hiring_offers
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT 300`

/** Reads the onboarding steps of a workspace, in order ($1 workspace). */
export const SELECT_WORKBENCH_ONBOARDING = sql`SELECT id, candidate_id, title, done, done_at, sort
FROM public.hiring_onboarding
WHERE workspace_id = $1
ORDER BY sort
LIMIT 2000`

/** Reads the active members of a workspace ($1 workspace). */
export const SELECT_WORKBENCH_MEMBERS = sql`SELECT user_id, display_name, role
FROM public.workspace_members
WHERE workspace_id = $1 AND status = 'active'
ORDER BY created_at
LIMIT 500`

/** Reads every availability window of a workspace ($1 workspace). */
export const SELECT_ALL_AVAILABILITY = sql`SELECT member_user_id, weekday, start_min, end_min
FROM public.hiring_availability
WHERE workspace_id = $1
LIMIT 2000`

/** Counts the hiring decisions that wait for the manager ($1 workspace). */
export const COUNT_WAITING_APPROVALS = sql`SELECT count(*)::int AS n
FROM public.work_items
WHERE workspace_id = $1 AND department = 'hiring' AND status = 'waiting_decision'`

/** The six ribbon figures of a workspace in one row ($1 workspace, $2 week start instant, $3 week end instant). */
export const SELECT_FIGURES = sql`SELECT
    (SELECT count(*)::int FROM public.hiring_jobs WHERE workspace_id = $1 AND status = 'open') AS open_roles,
    (SELECT count(*)::int FROM public.hiring_jobs WHERE workspace_id = $1) AS total_roles,
    (SELECT count(*)::int FROM public.hiring_candidates WHERE workspace_id = $1 AND stage IN ('applied', 'screening', 'shortlisted', 'interview', 'offer')) AS pipeline,
    (SELECT count(*)::int FROM public.hiring_interviews WHERE workspace_id = $1 AND status = 'confirmed' AND slot_start >= $2::timestamptz AND slot_start < $3::timestamptz) AS interviews_week,
    (SELECT count(*)::int FROM public.hiring_offers WHERE workspace_id = $1 AND status = 'waiting') AS offers_waiting,
    (SELECT count(*)::int FROM public.hiring_offers WHERE workspace_id = $1 AND status = 'sent') AS offers_sent`

/** Reads the events of one candidate, newest first ($1 workspace, $2 candidate). */
export const SELECT_CANDIDATE_EVENTS = sql`SELECT id, kind, actor, summary, created_at
FROM public.hiring_events
WHERE workspace_id = $1 AND candidate_id = $2::uuid
ORDER BY created_at DESC
LIMIT 60`
