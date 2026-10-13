-- The platform-admin console reads through the database transport: a staff member signed in to the web app reads the customer tables
-- under RLS, no back-end endpoint in between. Who is staff is a row in public.platform_admins (an email); public.is_platform_admin()
-- answers for the caller from the verified email claim of the JWT.
--   platform_admins          the staff emails (lower case); RLS on and no policy: only is_platform_admin() and the operator read it
--   is_platform_admin()      true for a signed-in caller whose email is listed; anyone else, signed in or not, gets false
--   <table>_platform_admin_select   one select policy per table the console shows
--   admin_console_*          definer functions for what RLS cannot reach (auth.users emails, aggregates, quota) and the audit trail
--   admin_extend_subscription / admin_set_workspace_status / admin_set_workspace_plan   the support actions, audited
-- The operator adds staff with: insert into public.platform_admins (email) values ('name@company.com');

create table if not exists public.platform_admins (
  email text primary key check (email = lower(btrim(email)) and email <> ''),
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public, anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.platform_admins a
      where a.email = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
    );
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

/* ------------------------------------------------------------------ read policies */

grant select on public.workspaces to authenticated;
drop policy if exists "workspaces_platform_admin_select" on public.workspaces;
create policy "workspaces_platform_admin_select" on public.workspaces for select to authenticated using ((select public.is_platform_admin()));

grant select on public.workspace_members to authenticated;
drop policy if exists "workspace_members_platform_admin_select" on public.workspace_members;
create policy "workspace_members_platform_admin_select" on public.workspace_members for select to authenticated using ((select public.is_platform_admin()));

grant select on public.workspace_invites to authenticated;
drop policy if exists "workspace_invites_platform_admin_select" on public.workspace_invites;
create policy "workspace_invites_platform_admin_select" on public.workspace_invites for select to authenticated using ((select public.is_platform_admin()));

grant select on public.payment_orders to authenticated;
drop policy if exists "payment_orders_platform_admin_select" on public.payment_orders;
create policy "payment_orders_platform_admin_select" on public.payment_orders for select to authenticated using ((select public.is_platform_admin()));

grant select on public.billing_events to authenticated;
drop policy if exists "billing_events_platform_admin_select" on public.billing_events;
create policy "billing_events_platform_admin_select" on public.billing_events for select to authenticated using ((select public.is_platform_admin()));

grant select on public.module_installations to authenticated;
drop policy if exists "module_installations_platform_admin_select" on public.module_installations;
create policy "module_installations_platform_admin_select" on public.module_installations for select to authenticated using ((select public.is_platform_admin()));

grant select on public.module_context_versions to authenticated;
drop policy if exists "module_context_versions_platform_admin_select" on public.module_context_versions;
create policy "module_context_versions_platform_admin_select" on public.module_context_versions for select to authenticated using ((select public.is_platform_admin()));

grant select on public.openclaw_agent_sync to authenticated;
drop policy if exists "openclaw_agent_sync_platform_admin_select" on public.openclaw_agent_sync;
create policy "openclaw_agent_sync_platform_admin_select" on public.openclaw_agent_sync for select to authenticated using ((select public.is_platform_admin()));

grant select on public.connections to authenticated;
drop policy if exists "connections_platform_admin_select" on public.connections;
create policy "connections_platform_admin_select" on public.connections for select to authenticated using ((select public.is_platform_admin()));

grant select on public.knowledge_sources to authenticated;
drop policy if exists "knowledge_sources_platform_admin_select" on public.knowledge_sources;
create policy "knowledge_sources_platform_admin_select" on public.knowledge_sources for select to authenticated using ((select public.is_platform_admin()));

grant select on public.sepay_transactions to authenticated;
drop policy if exists "sepay_transactions_platform_admin_select" on public.sepay_transactions;
create policy "sepay_transactions_platform_admin_select" on public.sepay_transactions for select to authenticated using ((select public.is_platform_admin()));

grant select on public.ai_quota_overrides to authenticated;
drop policy if exists "ai_quota_overrides_platform_admin_select" on public.ai_quota_overrides;
create policy "ai_quota_overrides_platform_admin_select" on public.ai_quota_overrides for select to authenticated using ((select public.is_platform_admin()));

grant select on public.app_errors to authenticated;
drop policy if exists "app_errors_platform_admin_select" on public.app_errors;
create policy "app_errors_platform_admin_select" on public.app_errors for select to authenticated using ((select public.is_platform_admin()));

grant select on public.platform_audit to authenticated;
drop policy if exists "platform_audit_platform_admin_select" on public.platform_audit;
create policy "platform_audit_platform_admin_select" on public.platform_audit for select to authenticated using ((select public.is_platform_admin()));

/* ------------------------------------------------------------------ definer reads */

-- The emails and last sign-ins of Auth users, for the staff only.
create or replace function public.admin_console_user_emails(p_ids uuid[])
returns table (id uuid, email text, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, u.last_sign_in_at from auth.users u where u.id = any (p_ids);
end;
$$;
revoke all on function public.admin_console_user_emails(uuid[]) from public, anon;
grant execute on function public.admin_console_user_emails(uuid[]) to authenticated;

-- The counts the workspace list needs, one row per workspace.
create or replace function public.admin_console_workspace_stats()
returns table (workspace_id uuid, members int, last_customer_message_at timestamptz, messages_7d int, open_decisions int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  return query select s.workspace_id, s.members, s.last_customer_message_at, s.messages_7d, s.open_decisions from public.admin_workspace_stats() s;
end;
$$;
revoke all on function public.admin_console_workspace_stats() from public, anon;
grant execute on function public.admin_console_workspace_stats() to authenticated;

-- New sign-ups per day (Vietnam time) for the health page.
create or replace function public.admin_console_signups(p_days int default 14)
returns table (day date, signups int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  return query select s.day, s.signups from public.admin_signups_per_day(p_days) s;
end;
$$;
revoke all on function public.admin_console_signups(int) from public, anon;
grant execute on function public.admin_console_signups(int) to authenticated;

-- This month's credits of one workspace against its allowance: { credits_used, credits_limit, cost_usd } or null.
create or replace function public.admin_console_quota(p_workspace uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  select jsonb_build_object('credits_used', q.credits_used, 'credits_limit', q.credits_limit, 'cost_usd', q.cost_usd)
    into v_result
    from public.ai_quota_status(p_workspace) q
    limit 1;
  return v_result;
end;
$$;
revoke all on function public.admin_console_quota(uuid) from public, anon;
grant execute on function public.admin_console_quota(uuid) to authenticated;

/* ------------------------------------------------------------------ audit */

-- Writes what the staff member viewed or changed. Staff only; the actor is the caller.
create or replace function public.admin_console_audit(p_action text, p_workspace uuid, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  insert into public.platform_audit (actor_email, actor_id, action, workspace_id, data)
  values (lower(btrim(auth.jwt() ->> 'email')), auth.uid(), left(p_action, 80), p_workspace, coalesce(p_data, '{}'::jsonb));
end;
$$;
revoke all on function public.admin_console_audit(text, uuid, jsonb) from public, anon;
grant execute on function public.admin_console_audit(text, uuid, jsonb) to authenticated;

/* ------------------------------------------------------------------ support actions */

-- Billing columns are server-only for a signed-in user; a support function opens the guard for its own transaction with this flag.
create or replace function public.workspaces_billing_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('nivo.billing_writer', true), '') <> 'on'
     and (new.status is distinct from old.status or new.plan_code is distinct from old.plan_code or new.paid_until is distinct from old.paid_until) then
    raise exception 'billing_columns_server_only' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Adds days to the subscription, counted from today when it already lapsed. Answers the new paid-until.
create or replace function public.admin_extend_subscription(p_workspace uuid, p_days int)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before timestamptz;
  v_after timestamptz;
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'days_invalid' using errcode = '22023';
  end if;
  select w.paid_until into v_before from public.workspaces w where w.id = p_workspace for update;
  if not found then
    raise exception 'WORKSPACES_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_after := greatest(coalesce(v_before, to_timestamp(0)), now()) + make_interval(days => p_days);
  perform set_config('nivo.billing_writer', 'on', true);
  update public.workspaces set paid_until = v_after where id = p_workspace;
  perform set_config('nivo.billing_writer', 'off', true);
  insert into public.platform_audit (actor_email, actor_id, action, workspace_id, data)
  values (lower(btrim(auth.jwt() ->> 'email')), auth.uid(), 'workspace.extend', p_workspace,
          jsonb_build_object('days', p_days, 'from', v_before, 'to', v_after));
  return v_after;
end;
$$;
revoke all on function public.admin_extend_subscription(uuid, int) from public, anon;
grant execute on function public.admin_extend_subscription(uuid, int) to authenticated;

-- Marks the workspace active or past due (billing status only).
create or replace function public.admin_set_workspace_status(p_workspace uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before text;
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  if p_status not in ('active', 'past_due') then
    raise exception 'status_invalid' using errcode = '22023';
  end if;
  select w.status into v_before from public.workspaces w where w.id = p_workspace for update;
  if not found then
    raise exception 'WORKSPACES_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform set_config('nivo.billing_writer', 'on', true);
  update public.workspaces set status = p_status where id = p_workspace;
  perform set_config('nivo.billing_writer', 'off', true);
  insert into public.platform_audit (actor_email, actor_id, action, workspace_id, data)
  values (lower(btrim(auth.jwt() ->> 'email')), auth.uid(), 'workspace.set_status', p_workspace,
          jsonb_build_object('from', v_before, 'to', p_status));
  return p_status;
end;
$$;
revoke all on function public.admin_set_workspace_status(uuid, text) from public, anon;
grant execute on function public.admin_set_workspace_status(uuid, text) to authenticated;

-- Moves a workspace to an active plan and gives it its own monthly credit allowance (null clears it so the plan's applies).
create or replace function public.admin_set_workspace_plan(p_workspace uuid, p_plan text, p_credits bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before text;
  v_plan text;
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  if p_credits is not null and p_credits < 0 then
    raise exception 'credits_invalid' using errcode = '22023';
  end if;
  select p.code into v_plan from public.plans p where p.code = p_plan and p.active = true;
  if not found then
    raise exception 'WORKSPACES_PLAN_UNKNOWN' using errcode = 'P0002';
  end if;
  select w.plan_code into v_before from public.workspaces w where w.id = p_workspace for update;
  if not found then
    raise exception 'WORKSPACES_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform set_config('nivo.billing_writer', 'on', true);
  update public.workspaces set plan_code = v_plan where id = p_workspace;
  perform set_config('nivo.billing_writer', 'off', true);
  insert into public.ai_quota_overrides (workspace_id, credits_limit, updated_at)
  values (p_workspace, p_credits, now())
  on conflict (workspace_id) do update set credits_limit = excluded.credits_limit, updated_at = excluded.updated_at;
  insert into public.platform_audit (actor_email, actor_id, action, workspace_id, data)
  values (lower(btrim(auth.jwt() ->> 'email')), auth.uid(), 'workspace.set_plan', p_workspace,
          jsonb_build_object('from', v_before, 'to', v_plan, 'creditsTo', p_credits));
  return jsonb_build_object('planCode', v_plan, 'creditsLimit', p_credits);
end;
$$;
revoke all on function public.admin_set_workspace_plan(uuid, text, bigint) from public, anon;
grant execute on function public.admin_set_workspace_plan(uuid, text, bigint) to authenticated;
