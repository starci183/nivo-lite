-- Setup chat as the way to fill the Second Brain and set an agent's boundaries. Additive.
--   module_setup_writes   one structured write NIVO proposes from an owner's answer in the setup chat, shown as a confirm card:
--                         kind 'fact' (a Second Brain fact: subject, attribute, value, scope) or 'rule' (an authority rule: action, mode, limit).
--                         The owner confirms (optionally edited) or rejects it; confirming performs the write (proposeFact with source 'owner',
--                         or the authority rule upsert) and records the outcome. source_message_id is the owner's message the write came from
--                         (the evidence of the fact).
create table if not exists public.module_setup_writes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  setup_session_id uuid not null references public.module_setup_sessions (id) on delete cascade,
  source_message_id uuid references public.module_setup_messages (id) on delete set null,
  gate_key text not null,
  kind text not null check (kind in ('fact', 'rule')),
  target_key text not null,                 -- "fact:<subject-key>|<attribute-key>" or "rule:<action>": one waiting card per target
  payload jsonb not null,                   -- fact: {subjectType, subjectLabel, attributeLabel, value, scope}; rule: {action, mode, limitVnd}
  status text not null default 'proposed' check (status in ('proposed', 'applied', 'rejected', 'superseded')),
  result jsonb,                             -- what the write did: {outcome, factId?, resolution?}
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists module_setup_writes_session on public.module_setup_writes (setup_session_id, created_at);
alter table public.module_setup_writes enable row level security;
create policy module_setup_writes_all on public.module_setup_writes for all
  using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
