-- Hiring on the back end: every write the hiring domain makes is one of the functions below (security invoker, granted to app_be only), and the
-- tick that used to call the web app over HTTP now sends one job per workspace to the hiring_tick queue. The old pg_cron entry is replaced.

select pgmq.create('hiring_tick');

-- ---------------------------------------------------------------- tokens

-- A fresh unguessable token for a link or an upload folder: 32 lower-case hex digits.
create or replace function public.hiring_new_token()
returns text language sql set search_path = public as $fn$
  select replace(gen_random_uuid()::text, '-', '');
$fn$;

-- ---------------------------------------------------------------- settings

-- Creates the settings of a workspace with a public slug. Answers created, exists (the workspace already has a row) or taken (the slug belongs to another workspace).
create or replace function public.hiring_settings_init(p_ws uuid, p_slug text)
returns text language plpgsql set search_path = public as $fn$
begin
  if exists (select 1 from public.hiring_settings where workspace_id = p_ws) then return 'exists'; end if;
  insert into public.hiring_settings (workspace_id, public_slug) values (p_ws, p_slug);
  return 'created';
exception when unique_violation then
  if exists (select 1 from public.hiring_settings where workspace_id = p_ws) then return 'exists'; end if;
  return 'taken';
end
$fn$;

-- Changes the settings named in the patch (keys publicSlug, retentionDays, notifyNewCandidate, remindInterview, autoCloseWhenFilled, applyConsentText, adTone).
-- Answers ok, taken (the slug belongs to another workspace) or missing.
create or replace function public.hiring_settings_save(p_ws uuid, p_patch jsonb)
returns text language plpgsql set search_path = public as $fn$
declare v_count int;
begin
  update public.hiring_settings set
    public_slug = coalesce(p_patch ->> 'publicSlug', public_slug),
    retention_days = coalesce((p_patch ->> 'retentionDays')::int, retention_days),
    notify_new_candidate = coalesce((p_patch ->> 'notifyNewCandidate')::boolean, notify_new_candidate),
    remind_interview = coalesce((p_patch ->> 'remindInterview')::boolean, remind_interview),
    auto_close_when_filled = coalesce((p_patch ->> 'autoCloseWhenFilled')::boolean, auto_close_when_filled),
    apply_consent_text = coalesce(p_patch ->> 'applyConsentText', apply_consent_text),
    ad_tone = coalesce(p_patch ->> 'adTone', ad_tone),
    updated_at = now()
  where workspace_id = p_ws;
  get diagnostics v_count = row_count;
  if v_count = 0 then return 'missing'; end if;
  return 'ok';
exception when unique_violation then
  return 'taken';
end
$fn$;

-- ---------------------------------------------------------------- jobs

-- Creates a job post; the fields are title, position, employmentType, schedule, payMinVnd, payMaxVnd, payUnit, location, headcount, description,
-- requirements, questions, channels, closesAt. Answers the id, or null when the slug is taken.
create or replace function public.hiring_job_create(p_ws uuid, p_user uuid, p_slug text, p_fields jsonb)
returns uuid language plpgsql set search_path = public as $fn$
declare v_id uuid;
begin
  insert into public.hiring_jobs (workspace_id, slug, title, position, employment_type, schedule, pay_min_vnd, pay_max_vnd, pay_unit, location, headcount,
    description, requirements, questions, channels, closes_at, created_by)
  values (p_ws, p_slug, p_fields ->> 'title', coalesce(p_fields ->> 'position', ''), coalesce(p_fields ->> 'employmentType', 'full_time'),
    coalesce(p_fields ->> 'schedule', ''), (p_fields ->> 'payMinVnd')::bigint, (p_fields ->> 'payMaxVnd')::bigint, coalesce(p_fields ->> 'payUnit', 'month'),
    coalesce(p_fields ->> 'location', ''), coalesce((p_fields ->> 'headcount')::int, 1), coalesce(p_fields ->> 'description', ''),
    coalesce(p_fields -> 'requirements', '{}'::jsonb), coalesce(p_fields -> 'questions', '[]'::jsonb),
    coalesce(array(select jsonb_array_elements_text(p_fields -> 'channels')), array['page']::text[]), (p_fields ->> 'closesAt')::timestamptz, p_user)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  return null;
end
$fn$;

-- Updates a job post with the same fields. Answers whether the job exists.
create or replace function public.hiring_job_update(p_ws uuid, p_id uuid, p_fields jsonb)
returns boolean language plpgsql set search_path = public as $fn$
declare v_count int;
begin
  update public.hiring_jobs set
    title = p_fields ->> 'title', position = coalesce(p_fields ->> 'position', ''), employment_type = coalesce(p_fields ->> 'employmentType', 'full_time'),
    schedule = coalesce(p_fields ->> 'schedule', ''), pay_min_vnd = (p_fields ->> 'payMinVnd')::bigint, pay_max_vnd = (p_fields ->> 'payMaxVnd')::bigint,
    pay_unit = coalesce(p_fields ->> 'payUnit', 'month'), location = coalesce(p_fields ->> 'location', ''),
    headcount = coalesce((p_fields ->> 'headcount')::int, 1), description = coalesce(p_fields ->> 'description', ''),
    requirements = coalesce(p_fields -> 'requirements', '{}'::jsonb), questions = coalesce(p_fields -> 'questions', '[]'::jsonb),
    channels = coalesce(array(select jsonb_array_elements_text(p_fields -> 'channels')), array['page']::text[]),
    closes_at = (p_fields ->> 'closesAt')::timestamptz, updated_at = now()
  where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  return v_count > 0;
end
$fn$;

create or replace function public.hiring_job_status(p_ws uuid, p_id uuid, p_status text)
returns boolean language plpgsql set search_path = public as $fn$
declare v_count int;
begin
  update public.hiring_jobs set status = p_status, updated_at = now() where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  return v_count > 0;
end
$fn$;

create or replace function public.hiring_job_ads(p_ws uuid, p_id uuid, p_ads jsonb)
returns boolean language plpgsql set search_path = public as $fn$
declare v_count int;
begin
  update public.hiring_jobs set ad_variants = p_ads, updated_at = now() where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  return v_count > 0;
end
$fn$;

-- Closes the open or paused jobs whose closing date has passed and answers their titles.
create or replace function public.hiring_jobs_expire(p_ws uuid)
returns text[] language plpgsql set search_path = public as $fn$
declare v_titles text[];
begin
  with closed as (
    update public.hiring_jobs set status = 'closed', updated_at = now()
    where workspace_id = p_ws and status in ('open', 'paused') and closes_at < now()
    returning title
  )
  select coalesce(array_agg(title), '{}') into v_titles from closed;
  return v_titles;
end
$fn$;

-- Closes a job once enough people accepted, when the workspace asked for it. Answers whether it closed, with the counts for the Office line.
create or replace function public.hiring_job_fill_check(p_ws uuid, p_job uuid)
returns table (closed boolean, title text, hired bigint, headcount int) language plpgsql set search_path = public as $fn$
begin
  return query
  with target as (
    select j.id, j.title as job_title, j.headcount as wanted, j.status,
      (select count(*) from public.hiring_candidates c where c.job_id = j.id and c.stage = 'hired') as got
    from public.hiring_jobs j
    join public.hiring_settings s on s.workspace_id = j.workspace_id and s.auto_close_when_filled
    where j.id = p_job and j.workspace_id = p_ws and j.status <> 'closed'
  ), shut as (
    update public.hiring_jobs j set status = 'closed', updated_at = now()
    from target t where j.id = t.id and t.got >= t.wanted
    returning j.id
  )
  select exists (select 1 from shut), t.job_title, t.got, t.wanted from target t;
end
$fn$;

-- ---------------------------------------------------------------- candidates

-- Stores an application with its consent and timeline lines. The same phone applying twice for a job is one application: the answer says duplicate.
-- Fields: name, phone, email, source, conversationId, cvPath, cvName, cvMime, cvSize, answers, availability.
create or replace function public.hiring_application_submit(p_ws uuid, p_job uuid, p_fields jsonb, p_consent text, p_ip text, p_lines text[])
returns table (id uuid, duplicate boolean) language plpgsql set search_path = public as $fn$
declare
  v_id uuid;
  v_name text := p_fields ->> 'name';
  v_phone text := coalesce(p_fields ->> 'phone', '');
begin
  if v_phone <> '' then
    select c.id into v_id from public.hiring_candidates c where c.job_id = p_job and c.phone = v_phone;
    if v_id is not null then return query select v_id, true; return; end if;
  end if;
  insert into public.hiring_candidates (workspace_id, job_id, name, phone, email, source, conversation_id, cv_path, cv_name, cv_mime, cv_size, answers, availability)
  values (p_ws, p_job, v_name, v_phone, coalesce(p_fields ->> 'email', ''), p_fields ->> 'source', (p_fields ->> 'conversationId')::uuid,
    p_fields ->> 'cvPath', p_fields ->> 'cvName', p_fields ->> 'cvMime', (p_fields ->> 'cvSize')::int, coalesce(p_fields -> 'answers', '[]'::jsonb),
    coalesce(p_fields ->> 'availability', ''))
  returning hiring_candidates.id into v_id;
  insert into public.hiring_consents (workspace_id, candidate_id, channel, consent_text, ip_hash) values (p_ws, v_id, p_fields ->> 'source', p_consent, p_ip);
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary)
  values (p_ws, v_id, 'applied', v_name, left(p_lines[1], 500)), (p_ws, v_id, 'consent', v_name, left(p_lines[2], 500));
  return query select v_id, false;
end
$fn$;

create or replace function public.hiring_event_log(p_ws uuid, p_candidate uuid, p_kind text, p_actor text, p_summary text)
returns void language plpgsql set search_path = public as $fn$
begin
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, p_candidate, p_kind, p_actor, left(p_summary, 500));
end
$fn$;

-- Moves a candidate to a stage (a rejection carries its reason) and logs the line. Answers whether the candidate exists.
create or replace function public.hiring_candidate_move(p_ws uuid, p_id uuid, p_stage text, p_reason text, p_actor text, p_summary text)
returns boolean language plpgsql set search_path = public as $fn$
declare v_count int;
begin
  update public.hiring_candidates set stage = p_stage, stage_changed_at = now(), rejected_reason = case when p_stage = 'rejected' then left(p_reason, 300) else rejected_reason end
  where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  if v_count = 0 then return false; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, p_id, 'stage', p_actor, left(p_summary, 500));
  return true;
end
$fn$;

create or replace function public.hiring_candidate_notes(p_ws uuid, p_id uuid, p_notes text, p_actor text, p_summary text)
returns boolean language plpgsql set search_path = public as $fn$
declare v_count int;
begin
  update public.hiring_candidates set notes = left(p_notes, 4000) where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  if v_count = 0 then return false; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, p_id, 'note', p_actor, left(p_summary, 500));
  return true;
end
$fn$;

-- Stores the advisory score; an applicant becomes "screening" and no other stage changes.
create or replace function public.hiring_candidate_screened(p_ws uuid, p_id uuid, p_score int, p_label text, p_reasons jsonb, p_summary text, p_actor text, p_line text)
returns boolean language plpgsql set search_path = public as $fn$
declare v_count int;
begin
  update public.hiring_candidates set score = p_score, score_label = p_label, score_reasons = coalesce(p_reasons, '[]'::jsonb), score_summary = p_summary, screened_at = now(),
    stage = case when stage = 'applied' then 'screening' else stage end,
    stage_changed_at = case when stage = 'applied' then now() else stage_changed_at end
  where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  if v_count = 0 then return false; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, p_id, 'screened', p_actor, left(p_line, 500));
  return true;
end
$fn$;

-- Deletes candidates with every trace (answers, consent, interviews, offers cascade) and answers the CV paths whose files must be removed.
create or replace function public.hiring_candidates_delete(p_ws uuid, p_ids uuid[])
returns text[] language plpgsql set search_path = public as $fn$
declare v_paths text[];
begin
  with gone as (
    delete from public.hiring_candidates where workspace_id = p_ws and id = any(p_ids) returning cv_path
  )
  select coalesce(array_agg(cv_path) filter (where cv_path is not null), '{}') into v_paths from gone;
  return v_paths;
end
$fn$;

-- Writes the retention line of a run (counts only).
create or replace function public.hiring_retention_log_add(p_ws uuid, p_candidates int, p_files int, p_days int)
returns void language plpgsql set search_path = public as $fn$
begin
  insert into public.hiring_retention_log (workspace_id, deleted_candidates, deleted_files, retention_days) values (p_ws, p_candidates, p_files, p_days);
end
$fn$;

-- Makes a hired candidate a person in the shifts of the workspace (with the position of the job when the shop has one of that name).
-- Answers the staff id and whether the shifts tables are missing a position, or null when the candidate is not hired or already linked.
create or replace function public.hiring_candidate_link_staff(p_ws uuid, p_id uuid)
returns table (staff_id uuid, missing boolean) language plpgsql set search_path = public as $fn$
declare
  v_cand public.hiring_candidates%rowtype;
  v_positions uuid[];
  v_staff uuid;
begin
  select * into v_cand from public.hiring_candidates where id = p_id and workspace_id = p_ws;
  if not found or v_cand.stage <> 'hired' or v_cand.staff_id is not null then
    return query select v_cand.staff_id, true;
    return;
  end if;
  select coalesce(array_agg(p.id), '{}') into v_positions
  from public.shifts_positions p
  join public.hiring_jobs j on j.id = v_cand.job_id
  where p.workspace_id = p_ws and p.active and lower(btrim(p.name)) in (lower(btrim(j.position)), lower(btrim(j.title)));
  insert into public.shifts_staff (workspace_id, name, phone, position_ids, active)
  values (p_ws, v_cand.name, nullif(v_cand.phone, ''), v_positions[1:1], true) returning id into v_staff;
  update public.hiring_candidates set staff_id = v_staff where id = p_id;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, p_id, 'staff_linked', 'NIVO', 'staff linked');
  return query select v_staff, false;
end
$fn$;

-- ---------------------------------------------------------------- interviews

-- Stores a proposed interview and moves an early-stage candidate to "interview". Fields: interviewerUserId, interviewerName, mode, location, durationMin, slots.
create or replace function public.hiring_interview_create(p_ws uuid, p_candidate uuid, p_job uuid, p_fields jsonb, p_token text, p_work uuid, p_actor text, p_line text)
returns uuid language plpgsql set search_path = public as $fn$
declare v_id uuid;
begin
  insert into public.hiring_interviews (workspace_id, candidate_id, job_id, interviewer_user_id, interviewer_name, mode, location, duration_min, proposed_slots, token, work_item_id)
  values (p_ws, p_candidate, p_job, (p_fields ->> 'interviewerUserId')::uuid, coalesce(p_fields ->> 'interviewerName', ''), p_fields ->> 'mode',
    coalesce(p_fields ->> 'location', ''), (p_fields ->> 'durationMin')::int, coalesce(p_fields -> 'slots', '[]'::jsonb), p_token, p_work)
  returning id into v_id;
  update public.hiring_candidates set stage = 'interview', stage_changed_at = now()
  where id = p_candidate and workspace_id = p_ws and stage in ('applied', 'screening', 'shortlisted');
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, p_candidate, 'interview_proposed', p_actor, left(p_line, 500));
  return v_id;
end
$fn$;

-- The candidate picks a proposed time: confirms a proposed interview once. Answers whether this call confirmed it.
create or replace function public.hiring_interview_confirm(p_token text, p_start timestamptz, p_end timestamptz, p_line text)
returns boolean language plpgsql set search_path = public as $fn$
declare v_row public.hiring_interviews%rowtype;
begin
  update public.hiring_interviews set status = 'confirmed', slot_start = p_start, slot_end = p_end, note = ''
  where token = p_token and status = 'proposed' returning * into v_row;
  if not found then return false; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (v_row.workspace_id, v_row.candidate_id, 'interview_confirmed', 'candidate', left(p_line, 500));
  return true;
end
$fn$;

-- The candidate says no proposed time fits: keeps the note and the timeline line.
create or replace function public.hiring_interview_none_fit(p_token text, p_note text, p_line text)
returns boolean language plpgsql set search_path = public as $fn$
declare v_row public.hiring_interviews%rowtype;
begin
  update public.hiring_interviews set note = left(p_note, 300) where token = p_token and status = 'proposed' returning * into v_row;
  if not found then return false; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (v_row.workspace_id, v_row.candidate_id, 'interview_declined_slots', 'candidate', left(p_line, 500));
  return true;
end
$fn$;

-- Sets the status of an interview and answers its candidate, or null when there is none.
create or replace function public.hiring_interview_status(p_ws uuid, p_id uuid, p_status text, p_actor text, p_line text)
returns uuid language plpgsql set search_path = public as $fn$
declare v_candidate uuid;
begin
  update public.hiring_interviews set status = p_status where id = p_id and workspace_id = p_ws returning candidate_id into v_candidate;
  if v_candidate is null then return null; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, v_candidate, 'interview_' || p_status, p_actor, left(p_line, 500));
  return v_candidate;
end
$fn$;

-- Marks the reminder of an interview as sent. Answers true to the one caller that marked it.
create or replace function public.hiring_interview_remind_claim(p_id uuid)
returns boolean language plpgsql set search_path = public as $fn$
declare v_count int;
begin
  update public.hiring_interviews set reminder_sent_at = now() where id = p_id and reminder_sent_at is null;
  get diagnostics v_count = row_count;
  return v_count > 0;
end
$fn$;

-- Replaces the weekly availability windows of a member and answers how many were saved. Windows: [{weekday, startMin, endMin}].
create or replace function public.hiring_availability_save(p_ws uuid, p_user uuid, p_windows jsonb)
returns int language plpgsql set search_path = public as $fn$
declare v_count int;
begin
  delete from public.hiring_availability where workspace_id = p_ws and member_user_id = p_user;
  insert into public.hiring_availability (workspace_id, member_user_id, weekday, start_min, end_min)
  select p_ws, p_user, (w ->> 'weekday')::smallint, (w ->> 'startMin')::int, (w ->> 'endMin')::int from jsonb_array_elements(coalesce(p_windows, '[]'::jsonb)) w;
  get diagnostics v_count = row_count;
  return v_count;
end
$fn$;

-- ---------------------------------------------------------------- offers

create or replace function public.hiring_offer_create(p_ws uuid, p_candidate uuid, p_job uuid, p_terms jsonb, p_token text, p_user uuid)
returns uuid language plpgsql set search_path = public as $fn$
declare v_id uuid;
begin
  insert into public.hiring_offers (workspace_id, candidate_id, job_id, terms, status, token, created_by) values (p_ws, p_candidate, p_job, p_terms, 'draft', p_token, p_user)
  returning id into v_id;
  return v_id;
end
$fn$;

-- Links an offer to its decision and sets the status the decision left it in.
create or replace function public.hiring_offer_link(p_ws uuid, p_id uuid, p_work uuid, p_status text)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.hiring_offers set work_item_id = p_work, status = case when p_status = 'draft' then status else p_status end where id = p_id and workspace_id = p_ws;
end
$fn$;

-- Marks an approved offer as sent and moves the candidate to "offer" unless the candidate is already closed.
create or replace function public.hiring_offer_sent(p_ws uuid, p_id uuid, p_draft text, p_via text, p_expires timestamptz, p_actor text, p_line text)
returns boolean language plpgsql set search_path = public as $fn$
declare v_candidate uuid;
begin
  update public.hiring_offers set draft = p_draft, status = 'sent', sent_at = now(), expires_at = p_expires, sent_via = p_via where id = p_id and workspace_id = p_ws
  returning candidate_id into v_candidate;
  if v_candidate is null then return false; end if;
  update public.hiring_candidates set stage = 'offer', stage_changed_at = now() where id = v_candidate and stage not in ('hired', 'rejected', 'withdrawn');
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, v_candidate, 'offer_sent', p_actor, left(p_line, 500));
  return true;
end
$fn$;

-- Cancels an offer in one of the given statuses and answers its candidate and decision, or nothing when it cannot be cancelled.
create or replace function public.hiring_offer_cancel(p_ws uuid, p_id uuid, p_statuses text[], p_actor text, p_line text)
returns table (candidate_id uuid, work_item_id uuid) language plpgsql set search_path = public as $fn$
declare v_row public.hiring_offers%rowtype;
begin
  update public.hiring_offers set status = 'cancelled' where id = p_id and workspace_id = p_ws and status = any(p_statuses) returning * into v_row;
  if not found then return; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, v_row.candidate_id, 'offer_cancelled', p_actor, left(p_line, 500));
  return query select v_row.candidate_id, v_row.work_item_id;
end
$fn$;

-- Lapses the sent offers past their date and answers the candidates.
create or replace function public.hiring_offers_expire(p_ws uuid, p_line text)
returns uuid[] language plpgsql set search_path = public as $fn$
declare v_ids uuid[];
begin
  with gone as (
    update public.hiring_offers set status = 'expired' where workspace_id = p_ws and status = 'sent' and expires_at < now() returning candidate_id
  ), logged as (
    insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) select p_ws, candidate_id, 'offer_expired', 'NIVO', left(p_line, 500) from gone returning candidate_id
  )
  select coalesce(array_agg(candidate_id), '{}') into v_ids from logged;
  return v_ids;
end
$fn$;

-- The candidate answers a sent offer: accepting makes them hired with the onboarding checklist, declining withdraws them. Answers accepted, declined or stale.
create or replace function public.hiring_offer_answer(p_token text, p_accept boolean, p_items text[], p_actor text, p_line text)
returns text language plpgsql set search_path = public as $fn$
declare v_row public.hiring_offers%rowtype;
begin
  update public.hiring_offers set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where token = p_token and status = 'sent' and (expires_at is null or expires_at >= now()) returning * into v_row;
  if not found then return 'stale'; end if;
  if p_accept then
    update public.hiring_candidates set stage = 'hired', stage_changed_at = now() where id = v_row.candidate_id;
    insert into public.hiring_onboarding (workspace_id, candidate_id, title, sort)
    select v_row.workspace_id, v_row.candidate_id, item, ordinality - 1 from unnest(p_items) with ordinality as t(item, ordinality);
  else
    update public.hiring_candidates set stage = 'withdrawn', stage_changed_at = now() where id = v_row.candidate_id;
  end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary)
  values (v_row.workspace_id, v_row.candidate_id, case when p_accept then 'offer_accepted' else 'offer_declined' end, p_actor, left(p_line, 500));
  return case when p_accept then 'accepted' else 'declined' end;
end
$fn$;

create or replace function public.hiring_onboarding_toggle(p_ws uuid, p_id uuid, p_done boolean)
returns boolean language plpgsql set search_path = public as $fn$
declare v_count int;
begin
  update public.hiring_onboarding set done = p_done, done_at = case when p_done then now() else null end where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  return v_count > 0;
end
$fn$;

-- ---------------------------------------------------------------- grants

do $$
declare f text;
begin
  foreach f in array array[
    'hiring_new_token()', 'hiring_settings_init(uuid, text)', 'hiring_settings_save(uuid, jsonb)', 'hiring_job_create(uuid, uuid, text, jsonb)', 'hiring_job_update(uuid, uuid, jsonb)',
    'hiring_job_status(uuid, uuid, text)', 'hiring_job_ads(uuid, uuid, jsonb)', 'hiring_jobs_expire(uuid)', 'hiring_job_fill_check(uuid, uuid)',
    'hiring_application_submit(uuid, uuid, jsonb, text, text, text[])', 'hiring_event_log(uuid, uuid, text, text, text)',
    'hiring_candidate_move(uuid, uuid, text, text, text, text)', 'hiring_candidate_notes(uuid, uuid, text, text, text)',
    'hiring_candidate_screened(uuid, uuid, int, text, jsonb, text, text, text)', 'hiring_candidates_delete(uuid, uuid[])',
    'hiring_retention_log_add(uuid, int, int, int)', 'hiring_candidate_link_staff(uuid, uuid)',
    'hiring_interview_create(uuid, uuid, uuid, jsonb, text, uuid, text, text)', 'hiring_interview_confirm(text, timestamptz, timestamptz, text)',
    'hiring_interview_none_fit(text, text, text)', 'hiring_interview_status(uuid, uuid, text, text, text)', 'hiring_interview_remind_claim(uuid)',
    'hiring_availability_save(uuid, uuid, jsonb)', 'hiring_offer_create(uuid, uuid, uuid, jsonb, text, uuid)', 'hiring_offer_link(uuid, uuid, uuid, text)',
    'hiring_offer_sent(uuid, uuid, text, text, timestamptz, text, text)', 'hiring_offer_cancel(uuid, uuid, text[], text, text)',
    'hiring_offers_expire(uuid, text)', 'hiring_offer_answer(text, boolean, text[], text, text)', 'hiring_onboarding_toggle(uuid, uuid, boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to app_be', f);
  end loop;
end $$;

-- ---------------------------------------------------------------- the tick

-- Every five minutes one job per workspace that uses hiring goes to the hiring_tick queue; the back end job does the reminders, the lapsing, the closing and the retention.
create or replace function public.hiring_tick()
returns boolean language plpgsql security definer set search_path = public as $fn$
declare
  v_slot text := to_char(date_trunc('minute', now()) - make_interval(mins => (extract(minute from now()))::int % 5), 'YYYYMMDDHH24MI');
  r record;
begin
  for r in select workspace_id from public.hiring_settings loop
    perform public.job_enqueue(r.workspace_id, 'hiring_tick', 'hiring_tick', jsonb_build_object('workspaceId', r.workspace_id), 'hiring_tick:' || r.workspace_id::text || ':' || v_slot);
  end loop;
  return true;
exception when others then
  raise notice 'hiring_tick failed: %', sqlerrm;
  return false;
end
$fn$;
revoke all on function public.hiring_tick() from public, anon, authenticated;
grant execute on function public.hiring_tick() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('hiring-tick');
    exception when others then
      raise notice 'no hiring-tick entry to unschedule (%)', sqlerrm;
    end;
    begin
      perform cron.schedule('hiring-tick', '*/5 * * * *', 'select public.hiring_tick()');
    exception when others then
      raise notice 'could not schedule hiring-tick (%)', sqlerrm;
    end;
  end if;
end $$;
