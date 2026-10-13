-- Lead flow (lead_gen): one row per prospect that came in through Facebook / Instagram (Lead Ads form, DM, comment, mention).
--   lead_flows   the state machine of one prospect: who they are (psid / igsid / phone / email, the dedupe keys), where they came from
--                (first source + every later touch: platform, post / ad / form id, referral), the owner's qualification questions asked so far and the
--                answers, the signals read from the free text, the hot / warm / cold score, and the last turn's analysis (one metered LLM call per turn;
--                `analysis.turn` is the idempotency key, so a retried step never pays twice).
--   state: new -> greeted -> qualifying -> (handed_off | nurturing | closed); scored = scored with no chat to continue (form, mention);
--          escalated = a person has it and the bot is silent (resume_state is where it goes back to when the person gives it back).
-- Additive. Reads: owners and managers. Every write goes through the service role (webhook, engine, performers).

create table if not exists public.lead_flows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  connection_id uuid references public.connections (id) on delete set null,
  conversation_id uuid references public.agent_conversations (id) on delete set null,
  platform text check (platform in ('facebook', 'instagram')),
  psid text,                                   -- Messenger page-scoped id
  igsid text,                                  -- Instagram-scoped id
  phone text,                                  -- normalised (84...)
  email text,                                  -- lower case
  name text,
  state text not null default 'new' check (state in ('new', 'greeted', 'qualifying', 'scored', 'handed_off', 'nurturing', 'closed', 'escalated')),
  resume_state text,
  source jsonb not null default '{}'::jsonb,   -- the first touch: { platform, kind, post_id, ad_id, form_id, comment_id, leadgen_id, referral }
  touches jsonb not null default '[]'::jsonb,  -- every touch, oldest first (deduped)
  answers jsonb not null default '[]'::jsonb,  -- [{ i, question, answer, at }]
  asked int not null default 0 check (asked between 0 and 4),
  pending_question int,                        -- index of the question waiting for an answer
  contact_asked_at timestamptz,                -- the phone / email was asked once (never twice)
  signals jsonb not null default '{}'::jsonb,  -- { need, contact, budget, timeline, area, asks_price_or_schedule, wants_meeting, interest }
  score text check (score in ('hot', 'warm', 'cold')),
  score_reasons jsonb not null default '[]'::jsonb,
  scored_at timestamptz,
  analysis jsonb,                              -- the last turn: { turn, sentiment, flags, confidence, reply, ... }
  last_user_at timestamptz,
  last_user_text text,
  greeted_at timestamptz,
  handed_off_at timestamptz,
  followed_up_at timestamptz,
  closed_at timestamptz,
  escalated_at timestamptz,
  escalation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- A Messenger / Instagram id is one person on one connection; a phone or email is searched, not unique (two people can share a family number).
create unique index if not exists lead_flows_psid on public.lead_flows (connection_id, psid) where psid is not null;
create unique index if not exists lead_flows_igsid on public.lead_flows (connection_id, igsid) where igsid is not null;
create unique index if not exists lead_flows_lead on public.lead_flows (workspace_id, lead_id) where lead_id is not null;
create index if not exists lead_flows_phone on public.lead_flows (workspace_id, phone) where phone is not null;
create index if not exists lead_flows_email on public.lead_flows (workspace_id, email) where email is not null;
create index if not exists lead_flows_state on public.lead_flows (workspace_id, state, updated_at desc);
alter table public.lead_flows enable row level security;
create policy lead_flows_read on public.lead_flows for select to authenticated using (public.is_manager(workspace_id));

-- Two more actions of the module: the warm follow-up and the polite close. Both message only inside the 24 hour window.
insert into public.authority_actions (action, module_key, sort_order, default_mode, default_limit_vnd, default_required_fields, amount_limit, max_mode, label) values
  ('follow_up_lead', 'lead_gen', 12, 'auto', null, array[]::text[], false, null, '{"vi":"Nhắn lại khách ấm","en":"Follow up a warm lead"}'::jsonb),
  ('close_lead', 'lead_gen', 13, 'auto', null, array[]::text[], false, null, '{"vi":"Khép lại với khách lạnh","en":"Politely close a cold lead"}'::jsonb)
on conflict (action) do update set
  module_key = excluded.module_key, sort_order = excluded.sort_order, default_mode = excluded.default_mode, default_limit_vnd = excluded.default_limit_vnd,
  default_required_fields = excluded.default_required_fields, amount_limit = excluded.amount_limit, max_mode = excluded.max_mode, label = excluded.label;
