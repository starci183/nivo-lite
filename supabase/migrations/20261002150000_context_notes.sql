-- Notes that supplement an agent's context later: "@Chatbot ghi nhớ: ..." in Office (any member) or an owner/manager in Setup chat.
-- A note is always a PROPOSAL: it is appended to the installation's current draft (module_setup_sessions.draft_snapshot.facts, key
-- note_<id8>) and listed here with its author and source until a manager approves it (the next context version) or dismisses it.
create table public.module_context_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  installation_id uuid not null references public.module_installations (id) on delete cascade,
  fact_key text not null,
  body text not null,
  source text not null default 'office' check (source in ('office', 'setup')),
  author_name text not null,
  author_role text not null default 'staff' check (author_role in ('owner', 'manager', 'staff')),
  author_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'applied', 'dismissed')),
  applied_version int,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index module_context_notes_inst on public.module_context_notes (installation_id, status, created_at desc);
alter table public.module_context_notes enable row level security;
-- Owner | manager read and decide. Notes are written by the server on behalf of any member (service role), never directly by a client.
create policy module_context_notes_manage on public.module_context_notes for all to authenticated
  using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
