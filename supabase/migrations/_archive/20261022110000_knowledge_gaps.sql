-- Knowledge gaps: what customers asked that the brain could not answer, so the owner fills it (the learning loop).
--   knowledge_gaps   one row per (workspace, module, similar question): the question as first asked (normalised), a topic guess
--                    ("subject | attribute" the answer would be filed under), how many times it was asked, first/last seen, one example
--                    conversation, and its status: open -> answered (a fact or document answering it was added) | dismissed (owner: not needed).
--                    A gap asked again after it was answered reopens (reopened_count grows). Similar questions are merged in the app by
--                    normalised keywords (no embedding call), keywords[] keeps what they were matched on.
-- Additive. Reads: owners and managers. Every write goes through the service role.

create table if not exists public.knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  module text not null,                        -- the customer-facing agent that could not answer (chatbot, booking, loyalty)
  question text not null,                      -- as the customer wrote it (first occurrence), trimmed
  question_key text not null,                  -- normalised: no accents, lower case, dashes
  keywords text[] not null default '{}',       -- significant words of the question (stop words removed)
  topic text,                                  -- subject guess ("Combo thư giãn")
  attribute_guess text,                        -- attribute guess ("Giá")
  count int not null default 1 check (count >= 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  example_conversation_id uuid references public.agent_conversations (id) on delete set null,
  source text not null default 'retrieval' check (source in ('model', 'retrieval')),   -- who noticed: the reply's knowledge_gap, or a search that found nothing
  status text not null default 'open' check (status in ('open', 'answered', 'dismissed')),
  answered_at timestamptz,
  answered_by text,                            -- "fact:<id>" | "document:<id>" | "owner"
  dismissed_at timestamptz,
  dismissed_by text,
  reopened_count int not null default 0,
  updated_at timestamptz not null default now()
);
create unique index if not exists knowledge_gaps_one_question on public.knowledge_gaps (workspace_id, module, question_key);
create index if not exists knowledge_gaps_ws_status on public.knowledge_gaps (workspace_id, status, last_seen_at desc);
alter table public.knowledge_gaps enable row level security;
create policy knowledge_gaps_read on public.knowledge_gaps for select to authenticated using (public.is_manager(workspace_id));
