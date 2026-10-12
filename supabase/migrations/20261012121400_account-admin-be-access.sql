-- What the team and platform-admin features of the back end (be/) read and write through the app_be role.
-- Row level security stays on for every table: app_be gets the narrowest policy of the table for each action it needs.
-- Auth facts the API needs about OTHER users (their emails, whether an email belongs to a member) are read through two
-- security definer functions in a schema the data API does not expose, so app_be never touches auth.* directly.

create schema if not exists be_access;
revoke all on schema be_access from public;
grant usage on schema be_access to app_be;

-- The emails and last sign-ins of the given Auth users (owner and member listings of the team console).
create or replace function be_access.user_emails(p_ids uuid[])
returns table (id uuid, email text, last_sign_in_at timestamptz)
language sql stable security definer set search_path = ''
as $$
    select u.id, u.email::text, u.last_sign_in_at from auth.users u where u.id = any (p_ids);
$$;

-- Whether a person with this email already belongs to the workspace (any status).
create or replace function be_access.member_has_email(p_workspace uuid, p_email text)
returns boolean
language sql stable security definer set search_path = ''
as $$
    select exists (
        select 1 from public.workspace_members m
        join auth.users u on u.id = m.user_id
        where m.workspace_id = p_workspace and lower(u.email) = lower(p_email)
    );
$$;

revoke all on function be_access.user_emails(uuid[]) from public, anon, authenticated;
revoke all on function be_access.member_has_email(uuid, text) from public, anon, authenticated;
grant execute on function be_access.user_emails(uuid[]) to app_be;
grant execute on function be_access.member_has_email(uuid, text) to app_be;

-- The existing console functions, now also callable by the API role.
grant execute on function public.admin_workspace_stats() to app_be;
grant execute on function public.admin_signups_per_day(int) to app_be;
grant execute on function public.ai_quota_status(uuid) to app_be;

-- ---------------------------------------------------------------- reads (team console, member role checks)
drop policy if exists "workspaces_app_be_select" on public.workspaces;
create policy "workspaces_app_be_select" on public.workspaces for select to app_be using (id is not null);
drop policy if exists "workspace_members_app_be_select" on public.workspace_members;
create policy "workspace_members_app_be_select" on public.workspace_members for select to app_be using (id is not null);
drop policy if exists "workspace_invites_app_be_select" on public.workspace_invites;
create policy "workspace_invites_app_be_select" on public.workspace_invites for select to app_be using (id is not null);
drop policy if exists "platform_audit_app_be_select" on public.platform_audit;
create policy "platform_audit_app_be_select" on public.platform_audit for select to app_be using (id is not null);
drop policy if exists "app_errors_app_be_select" on public.app_errors;
create policy "app_errors_app_be_select" on public.app_errors for select to app_be using (id is not null);
drop policy if exists "payment_orders_app_be_select" on public.payment_orders;
create policy "payment_orders_app_be_select" on public.payment_orders for select to app_be using (id is not null);
drop policy if exists "billing_events_app_be_select" on public.billing_events;
create policy "billing_events_app_be_select" on public.billing_events for select to app_be using (id is not null);
drop policy if exists "module_installations_app_be_select" on public.module_installations;
create policy "module_installations_app_be_select" on public.module_installations for select to app_be using (id is not null);
drop policy if exists "module_context_versions_app_be_select" on public.module_context_versions;
create policy "module_context_versions_app_be_select" on public.module_context_versions for select to app_be using (id is not null);
drop policy if exists "openclaw_agent_sync_app_be_select" on public.openclaw_agent_sync;
create policy "openclaw_agent_sync_app_be_select" on public.openclaw_agent_sync for select to app_be using (workspace_id is not null);
drop policy if exists "connections_app_be_select" on public.connections;
create policy "connections_app_be_select" on public.connections for select to app_be using (id is not null);
drop policy if exists "engine_jobs_app_be_select" on public.engine_jobs;
create policy "engine_jobs_app_be_select" on public.engine_jobs for select to app_be using (id is not null);
drop policy if exists "engine_workers_app_be_select" on public.engine_workers;
create policy "engine_workers_app_be_select" on public.engine_workers for select to app_be using (worker_id is not null);
drop policy if exists "knowledge_sources_app_be_select" on public.knowledge_sources;
create policy "knowledge_sources_app_be_select" on public.knowledge_sources for select to app_be using (id is not null);
drop policy if exists "sepay_transactions_app_be_select" on public.sepay_transactions;
create policy "sepay_transactions_app_be_select" on public.sepay_transactions for select to app_be using (id is not null);
drop policy if exists "ai_quota_overrides_app_be_select" on public.ai_quota_overrides;
create policy "ai_quota_overrides_app_be_select" on public.ai_quota_overrides for select to app_be using (workspace_id is not null);
drop policy if exists "plans_app_be_select" on public.plans;
create policy "plans_app_be_select" on public.plans for select to app_be using (code is not null);

-- ---------------------------------------------------------------- writes (support actions, invitations, evidence)
drop policy if exists "workspaces_app_be_update" on public.workspaces;
create policy "workspaces_app_be_update" on public.workspaces for update to app_be using (id is not null) with check (id is not null);
drop policy if exists "workspace_invites_app_be_insert" on public.workspace_invites;
create policy "workspace_invites_app_be_insert" on public.workspace_invites for insert to app_be with check (workspace_id is not null);
drop policy if exists "workspace_invites_app_be_update" on public.workspace_invites;
create policy "workspace_invites_app_be_update" on public.workspace_invites for update to app_be using (id is not null) with check (workspace_id is not null);
drop policy if exists "platform_audit_app_be_insert" on public.platform_audit;
create policy "platform_audit_app_be_insert" on public.platform_audit for insert to app_be with check (action is not null);
drop policy if exists "events_app_be_insert" on public.events;
create policy "events_app_be_insert" on public.events for insert to app_be with check (workspace_id is not null);
drop policy if exists "ai_quota_overrides_app_be_insert" on public.ai_quota_overrides;
create policy "ai_quota_overrides_app_be_insert" on public.ai_quota_overrides for insert to app_be with check (workspace_id is not null);
drop policy if exists "ai_quota_overrides_app_be_update" on public.ai_quota_overrides;
create policy "ai_quota_overrides_app_be_update" on public.ai_quota_overrides for update to app_be using (workspace_id is not null) with check (workspace_id is not null);

grant select on table public.workspaces, public.workspace_members, public.workspace_invites, public.platform_audit,
    public.app_errors, public.payment_orders, public.billing_events, public.module_installations,
    public.module_context_versions, public.openclaw_agent_sync, public.connections, public.engine_jobs,
    public.engine_workers, public.knowledge_sources, public.sepay_transactions, public.ai_quota_overrides,
    public.plans to app_be;
grant update on table public.workspaces to app_be;
grant insert, update on table public.workspace_invites to app_be;
grant insert on table public.platform_audit to app_be;
grant insert on table public.events to app_be;
grant insert, update on table public.ai_quota_overrides to app_be;
