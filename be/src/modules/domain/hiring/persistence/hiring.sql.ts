import { sql } from "@modules/platform/database"

/** Reads the hiring settings of a workspace ($1 workspace). */
export const SELECT_SETTINGS = sql`SELECT workspace_id, public_slug, retention_days, notify_new_candidate, remind_interview, auto_close_when_filled, apply_consent_text, ad_tone
FROM public.hiring_settings WHERE workspace_id = $1 LIMIT 1`

/** Reads the hiring settings behind a public slug ($1 slug). */
export const SELECT_SETTINGS_BY_SLUG = sql`SELECT workspace_id, public_slug, retention_days, notify_new_candidate, remind_interview, auto_close_when_filled, apply_consent_text, ad_tone
FROM public.hiring_settings WHERE public_slug = $1 LIMIT 1`

/** Reads the workspaces that use hiring, for the tick ($1 workspace). */
export const SELECT_TICK_WORKSPACE = sql`SELECT workspace_id, retention_days, remind_interview FROM public.hiring_settings WHERE workspace_id = $1 LIMIT 1`

/** Reads one job ($1 workspace, $2 job). */
export const SELECT_JOB = sql`SELECT id, workspace_id, slug, title, position, employment_type, schedule, pay_min_vnd, pay_max_vnd, pay_unit, location, headcount, description, requirements, questions, status, channels, closes_at
FROM public.hiring_jobs WHERE workspace_id = $1 AND id = $2::uuid LIMIT 1`

/** Reads one job by its slug ($1 workspace, $2 slug). */
export const SELECT_JOB_BY_SLUG = sql`SELECT id, workspace_id, slug, title, position, employment_type, schedule, pay_min_vnd, pay_max_vnd, pay_unit, location, headcount, description, requirements, questions, status, channels, closes_at
FROM public.hiring_jobs WHERE workspace_id = $1 AND slug = $2 LIMIT 1`

/** Reads the open jobs the chat takes applications for ($1 workspace). */
export const SELECT_CHAT_JOBS = sql`SELECT id, workspace_id, slug, title, position, employment_type, schedule, pay_min_vnd, pay_max_vnd, pay_unit, location, headcount, description, requirements, questions, status, channels, closes_at
FROM public.hiring_jobs WHERE workspace_id = $1 AND status = 'open' AND 'chat' = ANY(channels)
ORDER BY created_at LIMIT 5`

/** Reads the open and paused jobs of a workspace ($1 workspace). */
export const SELECT_LIVE_JOBS = sql`SELECT id FROM public.hiring_jobs WHERE workspace_id = $1 AND status IN ('open', 'paused') LIMIT 500`

/** Reads one candidate ($1 workspace, $2 candidate). */
export const SELECT_CANDIDATE = sql`SELECT id, workspace_id, job_id, name, phone, email, source, conversation_id, cv_path, cv_name, cv_mime, answers, availability, stage, staff_id
FROM public.hiring_candidates WHERE workspace_id = $1 AND id = $2::uuid LIMIT 1`

/** Reads one candidate by interview token holder ($1 candidate). */
export const SELECT_CANDIDATE_HEAD = sql`SELECT id, name FROM public.hiring_candidates WHERE id = $1::uuid LIMIT 1`

/** Reads the title, place and position of a job ($1 job). */
export const SELECT_JOB_HEAD = sql`SELECT title, location, position FROM public.hiring_jobs WHERE id = $1::uuid LIMIT 1`

/** Reads the candidates whose retention has run out ($1 workspace, $2 cutoff). */
export const SELECT_RETENTION_DUE = sql`SELECT id FROM public.hiring_candidates
WHERE workspace_id = $1 AND stage IN ('rejected', 'withdrawn') AND stage_changed_at < $2::timestamptz
ORDER BY stage_changed_at LIMIT 200`

/** Reads the open interview of a candidate ($1 candidate). */
export const SELECT_OPEN_INTERVIEW = sql`SELECT id FROM public.hiring_interviews WHERE candidate_id = $1::uuid AND status IN ('proposed', 'confirmed') LIMIT 1`

/** Reads the interview behind a link token ($1 token). */
export const SELECT_INTERVIEW_BY_TOKEN = sql`SELECT id, workspace_id, candidate_id, job_id, interviewer_user_id, interviewer_name, mode, location, duration_min, proposed_slots, slot_start, slot_end, status, token, work_item_id, note
FROM public.hiring_interviews WHERE token = $1 LIMIT 1`

/** Reads the confirmed interviews that start within a day and were not reminded ($1 workspace, $2 from, $3 until). */
export const SELECT_DUE_REMINDERS = sql`SELECT id, workspace_id, candidate_id, job_id, interviewer_user_id, interviewer_name, mode, location, duration_min, proposed_slots, slot_start, slot_end, status, token, work_item_id, note
FROM public.hiring_interviews
WHERE workspace_id = $1 AND status = 'confirmed' AND reminder_sent_at IS NULL AND slot_start >= $2::timestamptz AND slot_start <= $3::timestamptz
ORDER BY slot_start LIMIT 200`

/** Reads the busy times of an interviewer ($1 workspace, $2 user). */
export const SELECT_BUSY = sql`SELECT slot_start, slot_end, proposed_slots, status FROM public.hiring_interviews
WHERE workspace_id = $1 AND interviewer_user_id = $2::uuid AND status IN ('proposed', 'confirmed') LIMIT 500`

/** Reads the weekly availability windows of a member ($1 workspace, $2 user). */
export const SELECT_AVAILABILITY = sql`SELECT weekday, start_min, end_min FROM public.hiring_availability WHERE workspace_id = $1 AND member_user_id = $2::uuid LIMIT 50`

/** Reads the display name of an active member ($1 workspace, $2 user). */
export const SELECT_MEMBER_NAME = sql`SELECT user_id, display_name FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2::uuid AND status = 'active' LIMIT 1`

/** Reads the active members, the workspace owner first ($1 workspace). */
export const SELECT_INTERVIEWERS = sql`SELECT m.user_id, m.display_name, (m.user_id = w.owner_id) AS is_owner
FROM public.workspace_members m JOIN public.workspaces w ON w.id = m.workspace_id
WHERE m.workspace_id = $1 AND m.status = 'active'
ORDER BY (m.user_id = w.owner_id) DESC, m.created_at LIMIT 20`

/** Reads one offer ($1 workspace, $2 offer). */
export const SELECT_OFFER = sql`SELECT id, workspace_id, candidate_id, job_id, terms, draft, status, token, work_item_id, expires_at
FROM public.hiring_offers WHERE workspace_id = $1 AND id = $2::uuid LIMIT 1`

/** Reads the offer behind a link token ($1 token). */
export const SELECT_OFFER_BY_TOKEN = sql`SELECT id, workspace_id, candidate_id, job_id, terms, draft, status, token, work_item_id, expires_at
FROM public.hiring_offers WHERE token = $1 LIMIT 1`

/** Reads the open offer of a candidate ($1 candidate). */
export const SELECT_ACTIVE_OFFER = sql`SELECT id FROM public.hiring_offers WHERE candidate_id = $1::uuid AND status IN ('draft', 'waiting', 'sent') LIMIT 1`

/** Reads the channel of a chat conversation ($1 conversation). */
export const SELECT_CONVERSATION_CHANNEL = sql`SELECT channel FROM public.agent_conversations WHERE id = $1::uuid LIMIT 1`

/** Counts the earlier asks of one action and dedupe prefix so a repeated ask gets a fresh key ($1 workspace, $2 action, $3 key prefix pattern). */
export const COUNT_ASKS = sql`SELECT count(*)::int AS count FROM public.work_items WHERE workspace_id = $1 AND action = $2 AND dedupe_key LIKE $3`

/** Creates the settings of a workspace ($1 workspace, $2 slug); answers created, exists or taken. */
export const INIT_SETTINGS = sql`SELECT public.hiring_settings_init($1::uuid, $2::text) AS value`

/** Changes the settings ($1 workspace, $2 patch json); answers ok, taken or missing. */
export const SAVE_SETTINGS = sql`SELECT public.hiring_settings_save($1::uuid, $2::jsonb) AS value`

/** Creates a job ($1 workspace, $2 user, $3 slug, $4 fields json); answers its id, null when the slug is taken. */
export const CREATE_JOB = sql`SELECT public.hiring_job_create($1::uuid, $2::uuid, $3::text, $4::jsonb) AS id`

/** Updates a job ($1 workspace, $2 job, $3 fields json); answers whether it exists. */
export const UPDATE_JOB = sql`SELECT public.hiring_job_update($1::uuid, $2::uuid, $3::jsonb) AS value`

/** Sets the status of a job ($1 workspace, $2 job, $3 status). */
export const SET_JOB_STATUS = sql`SELECT public.hiring_job_status($1::uuid, $2::uuid, $3::text) AS value`

/** Stores the ads of a job ($1 workspace, $2 job, $3 ads json). */
export const SET_JOB_ADS = sql`SELECT public.hiring_job_ads($1::uuid, $2::uuid, $3::jsonb) AS value`

/** Closes the jobs past their closing date and answers their titles ($1 workspace). */
export const EXPIRE_JOBS = sql`SELECT public.hiring_jobs_expire($1::uuid) AS titles`

/** Closes a job that has enough hires, when the workspace asked for it ($1 workspace, $2 job). */
export const FILL_CHECK = sql`SELECT closed, title, hired, headcount FROM public.hiring_job_fill_check($1::uuid, $2::uuid) LIMIT 1`

/** Stores an application ($1 workspace, $2 job, $3 fields json, $4 consent text, $5 ip hash, $6 timeline lines). */
export const SUBMIT_APPLICATION = sql`SELECT id, duplicate FROM public.hiring_application_submit($1::uuid, $2::uuid, $3::jsonb, $4::text, $5::text, $6::text[]) LIMIT 1`

/** Writes a timeline line of a candidate ($1 workspace, $2 candidate, $3 kind, $4 actor, $5 summary). */
export const LOG_EVENT = sql`SELECT public.hiring_event_log($1::uuid, $2::uuid, $3::text, $4::text, $5::text)`

/** Moves a candidate to a stage ($1 workspace, $2 candidate, $3 stage, $4 reason, $5 actor, $6 summary). */
export const MOVE_CANDIDATE = sql`SELECT public.hiring_candidate_move($1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text) AS value`

/** Stores the notes of a candidate ($1 workspace, $2 candidate, $3 notes, $4 actor, $5 summary). */
export const SAVE_NOTES = sql`SELECT public.hiring_candidate_notes($1::uuid, $2::uuid, $3::text, $4::text, $5::text) AS value`

/** Stores the advisory score of a candidate ($1 workspace, $2 candidate, $3 score, $4 label, $5 reasons json, $6 summary, $7 actor, $8 line). */
export const SET_SCREENED = sql`SELECT public.hiring_candidate_screened($1::uuid, $2::uuid, $3::int, $4::text, $5::jsonb, $6::text, $7::text, $8::text) AS value`

/** Deletes candidates with every trace and answers the CV paths ($1 workspace, $2 candidates). */
export const DELETE_CANDIDATES = sql`SELECT public.hiring_candidates_delete($1::uuid, $2::uuid[]) AS paths`

/** Writes the retention line of a run ($1 workspace, $2 candidates, $3 files, $4 days). */
export const LOG_RETENTION = sql`SELECT public.hiring_retention_log_add($1::uuid, $2::int, $3::int, $4::int)`

/** Makes a hired candidate a person in the shifts ($1 workspace, $2 candidate). */
export const LINK_STAFF = sql`SELECT staff_id, missing FROM public.hiring_candidate_link_staff($1::uuid, $2::uuid) LIMIT 1`

/** Stores a proposed interview ($1 workspace, $2 candidate, $3 job, $4 fields json, $5 token, $6 work item, $7 actor, $8 line). */
export const CREATE_INTERVIEW = sql`SELECT public.hiring_interview_create($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::text, $6::uuid, $7::text, $8::text) AS id`

/** Confirms a proposed interview at the chosen time ($1 token, $2 start, $3 end, $4 line). */
export const CONFIRM_INTERVIEW = sql`SELECT public.hiring_interview_confirm($1::text, $2::timestamptz, $3::timestamptz, $4::text) AS value`

/** Records that no proposed time fits ($1 token, $2 note, $3 line). */
export const NONE_FIT_INTERVIEW = sql`SELECT public.hiring_interview_none_fit($1::text, $2::text, $3::text) AS value`

/** Sets the status of an interview ($1 workspace, $2 interview, $3 status, $4 actor, $5 line); answers the candidate. */
export const SET_INTERVIEW_STATUS = sql`SELECT public.hiring_interview_status($1::uuid, $2::uuid, $3::text, $4::text, $5::text) AS id`

/** Marks the reminder of an interview as sent ($1 interview). */
export const CLAIM_REMINDER = sql`SELECT public.hiring_interview_remind_claim($1::uuid) AS value`

/** Replaces the availability windows of a member ($1 workspace, $2 user, $3 windows json). */
export const SAVE_AVAILABILITY = sql`SELECT public.hiring_availability_save($1::uuid, $2::uuid, $3::jsonb) AS value`

/** Stores a draft offer ($1 workspace, $2 candidate, $3 job, $4 terms json, $5 token, $6 user). */
export const CREATE_OFFER = sql`SELECT public.hiring_offer_create($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::text, $6::uuid) AS id`

/** Links an offer to its decision ($1 workspace, $2 offer, $3 work item, $4 status). */
export const LINK_OFFER = sql`SELECT public.hiring_offer_link($1::uuid, $2::uuid, $3::uuid, $4::text)`

/** Marks an approved offer as sent ($1 workspace, $2 offer, $3 letter, $4 via, $5 expiry, $6 actor, $7 line). */
export const MARK_OFFER_SENT = sql`SELECT public.hiring_offer_sent($1::uuid, $2::uuid, $3::text, $4::text, $5::timestamptz, $6::text, $7::text) AS value`

/** Cancels an offer in one of the statuses ($1 workspace, $2 offer, $3 statuses, $4 actor, $5 line). */
export const CANCEL_OFFER = sql`SELECT candidate_id, work_item_id FROM public.hiring_offer_cancel($1::uuid, $2::uuid, $3::text[], $4::text, $5::text) LIMIT 1`

/** Lapses the sent offers past their date and answers the candidates ($1 workspace, $2 line). */
export const EXPIRE_OFFERS = sql`SELECT public.hiring_offers_expire($1::uuid, $2::text) AS ids`

/** The candidate answers a sent offer ($1 token, $2 accept, $3 onboarding items, $4 actor, $5 line). */
export const ANSWER_OFFER = sql`SELECT public.hiring_offer_answer($1::text, $2::boolean, $3::text[], $4::text, $5::text) AS value`

/** Ticks an onboarding step ($1 workspace, $2 step, $3 done). */
export const TOGGLE_ONBOARDING = sql`SELECT public.hiring_onboarding_toggle($1::uuid, $2::uuid, $3::boolean) AS value`
