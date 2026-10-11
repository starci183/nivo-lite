-- "Want it" on a planned connector of the Connections library: one row per workspace and connector, so NIVO builds the most
-- wanted ones first. Additive. Members of the workspace read their own; the server writes with the service role.
create table if not exists public.connector_interest (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connector_id text not null check (char_length(connector_id) between 1 and 60),
  user_id uuid,
  created_at timestamptz not null default now(),
  primary key (workspace_id, connector_id)
);
alter table public.connector_interest enable row level security;
create policy connector_interest_read on public.connector_interest for select to authenticated using (public.is_member(workspace_id));
