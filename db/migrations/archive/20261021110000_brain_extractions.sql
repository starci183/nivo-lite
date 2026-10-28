-- Second brain from documents: facts are read out of ONE document when it becomes ready, and only that document is re-read when it changes.
--   brain_extractions   one row per document: where the reading stands (queued | running | done | failed | blocked_credits), how many facts it
--                       proposed, which model and prompt version read it, and a hash of the text it read, so nothing runs twice.
--   brain_facts.proposal_kind  'set' (a value) or 'retire' (a proposal to stop using an active fact whose last evidence was a document that
--                       changed or was deleted). A retire proposal points at the fact in conflict_with and carries its value.
--   ai_usage_events.kind 'brain': the model calls of this pipeline are charged to the workspace's credits under their own kind.
-- Additive. Reads: owners and managers. Every write goes through the service role.

alter table public.ai_usage_events drop constraint if exists ai_usage_events_kind_check;
alter table public.ai_usage_events
  add constraint ai_usage_events_kind_check
  check (kind in ('chat_reply', 'setup', 'owner_chat', 'relay', 'embedding', 'engine', 'guide', 'brain'));

alter table public.brain_facts add column if not exists proposal_kind text not null default 'set' check (proposal_kind in ('set', 'retire'));
create index if not exists brain_facts_ws_proposal on public.brain_facts (workspace_id, subject_key, attribute) where status = 'proposed';

create table if not exists public.brain_extractions (
  source_id uuid primary key references public.knowledge_sources (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'blocked_credits')),
  facts_proposed int not null default 0,
  error text,
  model text,
  prompt_version int not null,
  content_hash text,                              -- hash of the text that was (or is being) read
  windows_total int not null default 0,           -- the document is read in windows; a run may stop and resume at windows_done
  windows_done int not null default 0,
  attempts int not null default 0,
  orphan_fact_ids uuid[] not null default '{}',   -- active facts that lost their last evidence when the document changed
  updated_at timestamptz not null default now()
);
create index if not exists brain_extractions_ws on public.brain_extractions (workspace_id, status, updated_at);
alter table public.brain_extractions enable row level security;
create policy brain_extractions_read on public.brain_extractions for select to authenticated using (public.is_manager(workspace_id));
