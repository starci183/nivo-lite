-- Second brain: ONE shared memory per workspace, read by every agent through its own view. Additive.
--   brain_facts           what is true about the business (prices, hours, policies, people, customers...), each with its source,
--                         trust, scope, validity window and evidence. Exactly one ACTIVE fact per (subject, attribute); a new value
--                         supersedes the old one (history is kept). Low-trust inputs only PROPOSE; an owner or manager decides.
--   brain_lessons         how an agent should work (procedural memory), learnt from the owner's edits, notes and outcomes;
--                         proposed, approved, versioned. module null = every agent.
--   brain_source_profiles how to read one data source (connection + entity): what each field means, its type and format;
--                         proposed from samples, confirmed once by the owner, then every read follows it.
--   brain_eval_cases      known-good answers kept as regression cases (a correction becomes a case).
-- Reads: members see public and internal facts, managers see everything. Every write goes through the service role.

create table if not exists public.brain_facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  subject_type text not null default 'business'
    check (subject_type in ('business', 'product', 'service', 'policy', 'customer', 'person', 'supplier', 'place', 'other')),
  subject_key text not null,                 -- normalised (no accents, lower case, dashes): "combo-thu-gian"
  subject_label text not null,               -- as people write it: "Combo thư giãn"
  attribute text not null,                   -- normalised: "gia"
  attribute_label text not null,             -- "Giá"
  value text not null,                       -- "650.000đ / 90 phút"
  value_number numeric,                      -- 650000 when the value is a number (price, quantity), for exact reads
  unit text,                                 -- "VND", "phút"...
  scope text not null default 'internal' check (scope in ('public', 'internal', 'restricted')),
  modules text[] not null default '{}',      -- restricted facts: the modules allowed to see them
  -- scheduled = approved, takes over from the active fact at valid_from ("850.000đ từ 1/11"); until then the old value stays in force.
  status text not null default 'proposed' check (status in ('proposed', 'scheduled', 'active', 'superseded', 'rejected', 'expired')),
  source_kind text not null check (source_kind in ('owner', 'manager', 'document', 'system', 'staff', 'customer', 'ai')),
  trust smallint not null check (trust between 0 and 100),
  valid_from timestamptz,
  valid_to timestamptz,
  supersedes_id uuid references public.brain_facts (id) on delete set null,
  conflict_with uuid references public.brain_facts (id) on delete set null,   -- the active fact a proposal disagrees with
  evidence jsonb not null default '[]'::jsonb,   -- [{kind, ref, label, quote, at, connection_id}]
  proposed_by text not null,
  proposed_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to > valid_from)
);
create unique index if not exists brain_facts_one_active on public.brain_facts (workspace_id, subject_key, attribute) where status = 'active';
create index if not exists brain_facts_ws_status on public.brain_facts (workspace_id, status, updated_at desc);
create index if not exists brain_facts_ws_subject on public.brain_facts (workspace_id, subject_key);
create index if not exists brain_facts_search on public.brain_facts
  using gin (to_tsvector('simple', subject_label || ' ' || attribute_label || ' ' || value));
alter table public.brain_facts enable row level security;
create policy brain_facts_read on public.brain_facts for select to authenticated
  using (public.is_manager(workspace_id) or (scope <> 'restricted' and public.is_member(workspace_id)));

create table if not exists public.brain_lessons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  module text,                               -- null = every agent
  title text not null,
  body text not null,
  applies_when text not null default '',
  status text not null default 'proposed' check (status in ('proposed', 'active', 'retired', 'rejected')),
  origin text not null default 'manual' check (origin in ('edits', 'note', 'outcome', 'manual')),
  evidence jsonb not null default '[]'::jsonb,
  version int not null default 1,
  supersedes_id uuid references public.brain_lessons (id) on delete set null,
  proposed_by text not null,
  proposed_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz
);
create index if not exists brain_lessons_ws on public.brain_lessons (workspace_id, status, module);
alter table public.brain_lessons enable row level security;
create policy brain_lessons_read on public.brain_lessons for select to authenticated using (public.is_member(workspace_id));

create table if not exists public.brain_source_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  entity text not null,
  field_map jsonb not null default '{}'::jsonb,   -- {source_field: {meaning, type, format, note}}
  trust smallint not null default 60 check (trust between 0 and 100),
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  sample jsonb not null default '[]'::jsonb,
  notes text not null default '',
  confirmed_by text,
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (connection_id, entity)
);
alter table public.brain_source_profiles enable row level security;
create policy brain_source_profiles_read on public.brain_source_profiles for select to authenticated using (public.is_manager(workspace_id));

create table if not exists public.brain_eval_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  module text,
  kind text not null check (kind in ('qa', 'extract', 'draft')),
  input jsonb not null,
  expected jsonb not null,
  origin_ref text,
  created_at timestamptz not null default now()
);
create index if not exists brain_eval_cases_ws on public.brain_eval_cases (workspace_id, module, kind);
alter table public.brain_eval_cases enable row level security;
create policy brain_eval_cases_read on public.brain_eval_cases for select to authenticated using (public.is_manager(workspace_id));
