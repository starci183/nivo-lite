-- NIVO team console (/admin). Server-only data: no policy for anon/authenticated, service_role reads and writes.
--   platform_audit        every admin view and action: who, what, which workspace
--   app_errors            errors captured at the API route boundary (reportError)
--   admin_workspace_stats one row per workspace with the counts the workspace list needs (one query instead of 100 x N)

create table public.platform_audit (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  actor_id uuid,
  action text not null,                              -- view.workspaces | view.workspace | view.health | workspace.extend | workspace.set_status | invite.resend
  workspace_id uuid references public.workspaces (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index platform_audit_recent on public.platform_audit (created_at desc);
create index platform_audit_workspace on public.platform_audit (workspace_id, created_at desc);

create table public.app_errors (
  id uuid primary key default gen_random_uuid(),
  scope text not null,                               -- e.g. api.telegram, api.sepay
  message text not null,
  stack text,
  workspace_id uuid references public.workspaces (id) on delete set null,
  ctx jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index app_errors_recent on public.app_errors (created_at desc);
create index app_errors_workspace on public.app_errors (workspace_id, created_at desc) where workspace_id is not null;

alter table public.platform_audit enable row level security;
alter table public.app_errors enable row level security;
revoke all on public.platform_audit from anon, authenticated;
revoke all on public.app_errors from anon, authenticated;
grant all on public.platform_audit to service_role;
grant all on public.app_errors to service_role;

create or replace function public.admin_workspace_stats()
returns table (
  workspace_id uuid,
  members int,
  last_customer_message_at timestamptz,
  messages_7d int,
  open_decisions int
) language sql stable security definer set search_path = public as $$
  select
    w.id,
    (select count(*)::int from public.workspace_members m where m.workspace_id = w.id and m.status = 'active'),
    (select max(am.created_at) from public.agent_messages am join public.agent_conversations c on c.id = am.conversation_id
       where am.workspace_id = w.id and am.role = 'user' and c.kind = 'customer'),
    (select count(*)::int from public.agent_messages am join public.agent_conversations c on c.id = am.conversation_id
       where am.workspace_id = w.id and am.role = 'user' and c.kind = 'customer' and am.created_at > now() - interval '7 days'),
    (select count(*)::int from public.work_items wi where wi.workspace_id = w.id and wi.status = 'waiting_decision')
  from public.workspaces w;
$$;
revoke all on function public.admin_workspace_stats() from public, anon, authenticated;
grant execute on function public.admin_workspace_stats() to service_role;

-- New sign-ups per day (Vietnam time) for the platform health page; auth.users is not readable through the API.
create or replace function public.admin_signups_per_day(p_days int default 14)
returns table (day date, signups int) language sql stable security definer set search_path = public, auth as $$
  select (u.created_at at time zone 'Asia/Ho_Chi_Minh')::date, count(*)::int
  from auth.users u
  where u.created_at > now() - make_interval(days => greatest(1, least(p_days, 90)))
  group by 1 order by 1 desc;
$$;
revoke all on function public.admin_signups_per_day(int) from public, anon, authenticated;
grant execute on function public.admin_signups_per_day(int) to service_role;
