-- The backend's asynchronous lead actions. GraphQL creates a run and its pgmq delivery in one transaction;
-- the fenced worker records the outcome here, and GraphQL exposes workspace-scoped progress.
create table public.lead_actions (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    requested_by uuid not null references auth.users(id),
    action text not null check (action in ('create', 'refresh-context', 'suggest-owner', 'draft-execution', 'settle-won')),
    input jsonb not null,
    locale text not null check (locale in ('vi', 'en')),
    status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
    job_id uuid,
    fencing_token bigint,
    result jsonb,
    error_code text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index lead_actions_workspace_created on public.lead_actions(workspace_id, created_at desc);
alter table public.lead_actions enable row level security;
revoke all on public.lead_actions from public, anon, authenticated;
grant select, insert, update, delete on public.lead_actions to app_be;
create policy lead_actions_app_be_select on public.lead_actions for select to app_be using (true);
create policy lead_actions_app_be_insert on public.lead_actions for insert to app_be with check (true);
create policy lead_actions_app_be_update on public.lead_actions for update to app_be using (true) with check (true);
create policy lead_actions_app_be_delete on public.lead_actions for delete to app_be using (true);
select pgmq.create('lead_actions');
