-- NIVO operating flow: authority -> inputs -> AI departments -> auto or ask -> governance. Additive only.

-- 1. Owner grants authority (one row per workspace)
create table if not exists public.authority (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  goal_revenue_vnd bigint check (goal_revenue_vnd is null or goal_revenue_vnd >= 0),
  goal_new_customers int check (goal_new_customers is null or goal_new_customers >= 0),
  goal_first_reply_minutes int check (goal_first_reply_minutes is null or goal_first_reply_minutes > 0),
  goal_note text not null default '',
  policies text not null default '',        -- business rules, one per line
  reply_style text not null default '',
  brand_voice text not null default '',
  limits_note text not null default '',     -- plain-language "always ask me first when..."
  demo_seeded_at timestamptz,               -- flow demo examples inserted once (backfill for old workspaces)
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.authority_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  department text not null check (department in ('chatbot', 'sales', 'accounting')),
  action text not null check (action in (
    'reply_customer', 'handoff_lead', 'classify_lead', 'send_follow_up', 'send_quote',
    'confirm_order', 'send_care', 'issue_invoice', 'reconcile_payment')),
  mode text not null default 'ask' check (mode in ('auto', 'ask', 'never')),
  limit_vnd bigint check (limit_vnd is null or limit_vnd >= 0),   -- auto only up to this amount
  required_fields text[] not null default '{}',                    -- missing => ask (missing_data)
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (workspace_id, department, action)
);

-- Optional staff (named people who can take over or handle exceptions; decisions are still made by the signed-in user)
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  role text not null default '',
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Inputs
alter table public.leads add column if not exists phone text;
alter table public.leads add column if not exists email text;
alter table public.leads add column if not exists origin text check (origin in ('live', 'simulated')); -- null = legacy/seed, unlabelled

create table if not exists public.inbound_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  channel text not null check (channel in ('website', 'facebook', 'zalo', 'email', 'phone', 'bank', 'manual')),
  kind text not null check (kind in ('message', 'lead', 'order', 'invoice', 'payment')),
  origin text not null check (origin in ('live', 'simulated')),
  sender_name text,
  sender_contact text,                -- normalised phone or email
  body text not null default '',
  amount_vnd bigint,
  external_ref text,                  -- e.g. bank reference, order code
  dedupe_key text not null,
  duplicate_count int not null default 0,
  last_duplicate_at timestamptz,
  lead_id uuid references public.leads (id) on delete set null,
  status text not null default 'received' check (status in ('received', 'processed', 'needs_decision', 'failed')),
  created_at timestamptz not null default now(),
  unique (workspace_id, dedupe_key)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  inbound_event_id uuid references public.inbound_events (id) on delete set null,
  order_no text not null,
  items text not null default '',
  amount_vnd bigint check (amount_vnd is null or amount_vnd >= 0),
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'invoiced', 'paid', 'cancelled')),
  origin text not null default 'live' check (origin in ('live', 'simulated')),
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, order_no)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  invoice_no text not null,
  amount_vnd bigint not null check (amount_vnd >= 0),
  due_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'void')),
  origin text not null default 'live' check (origin in ('live', 'simulated')),
  issued_by text,
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, invoice_no)
);
create unique index if not exists invoices_one_per_order on public.invoices (order_id) where order_id is not null; -- CORE dedupe

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  inbound_event_id uuid references public.inbound_events (id) on delete set null,
  channel text not null default 'bank' check (channel in ('bank', 'cash', 'card', 'ewallet')),
  amount_vnd bigint not null check (amount_vnd >= 0),
  reference text,
  payer text,
  occurred_at timestamptz not null default now(),
  invoice_id uuid references public.invoices (id) on delete set null,
  status text not null default 'unmatched' check (status in ('unmatched', 'matched', 'needs_review')),
  origin text not null default 'live' check (origin in ('live', 'simulated')),
  created_at timestamptz not null default now()
);

-- 3/4. The unit of AI work that passes the gate, waits for a decision, and resumes
create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  department text not null check (department in ('chatbot', 'sales', 'accounting')),
  action text not null,
  subject_type text not null check (subject_type in ('lead', 'order', 'invoice', 'transaction', 'conversation', 'inbound')),
  subject_id uuid,
  lead_id uuid references public.leads (id) on delete cascade,
  inbound_event_id uuid references public.inbound_events (id) on delete set null,
  parent_id uuid references public.work_items (id) on delete set null,   -- handoff chain
  dedupe_key text not null,                                               -- e.g. 'issue_invoice:order:<id>'
  status text not null default 'queued' check (status in ('queued', 'done', 'waiting_decision', 'rejected', 'failed')),
  decided_path text check (decided_path in ('auto', 'human')),
  reason text check (reason in ('routine', 'missing_data', 'over_authority', 'unclear_outcome', 'not_allowed')),
  reasons text[] not null default '{}',
  missing_fields text[] not null default '{}',
  proposal jsonb not null default '{}'::jsonb,   -- NIVO's proposal (summary, draft, amount_vnd, fields, candidates)
  result jsonb,
  error text,
  evidence_state text not null default 'pending'
    check (evidence_state in ('pending', 'captured', 'reviewed', 'verified', 'customer_confirmed')),
  assigned_staff_id uuid references public.staff (id) on delete set null,
  execution_id uuid references public.executions (id) on delete set null, -- legacy approval card link
  origin text not null default 'live' check (origin in ('live', 'simulated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, dedupe_key)
);

-- 5. Decision history (append-only, like events)
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  work_item_id uuid references public.work_items (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  department text not null,
  action text not null,
  decided_by text not null,                                   -- 'NIVO' for policy
  decider_kind text not null check (decider_kind in ('policy', 'owner', 'staff')),
  outcome text not null check (outcome in ('auto_done', 'approved', 'edited', 'rejected')),
  reason text,
  note text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- Links from existing tables
alter table public.executions add column if not exists work_item_id uuid references public.work_items (id) on delete set null;
alter table public.messages add column if not exists work_item_id uuid references public.work_items (id) on delete set null;
alter table public.events add column if not exists work_item_id uuid references public.work_items (id) on delete set null;
alter table public.agent_conversations add column if not exists handled_by text;      -- human takeover: AI stays quiet
alter table public.agent_conversations add column if not exists handled_at timestamptz;

create index if not exists authority_rules_ws on public.authority_rules (workspace_id);
create index if not exists staff_ws on public.staff (workspace_id);
create index if not exists inbound_ws_created on public.inbound_events (workspace_id, created_at desc);
create index if not exists orders_ws on public.orders (workspace_id, status);
create index if not exists invoices_ws on public.invoices (workspace_id, status);
create index if not exists transactions_ws on public.transactions (workspace_id, status);
create index if not exists work_items_ws_status on public.work_items (workspace_id, status, created_at desc);
create index if not exists work_items_lead on public.work_items (lead_id);
create index if not exists decisions_ws_created on public.decisions (workspace_id, created_at desc);
create index if not exists leads_ws_phone on public.leads (workspace_id, phone);
create index if not exists leads_ws_email on public.leads (workspace_id, email);

alter table public.authority enable row level security;
alter table public.authority_rules enable row level security;
alter table public.staff enable row level security;
alter table public.inbound_events enable row level security;
alter table public.orders enable row level security;
alter table public.invoices enable row level security;
alter table public.transactions enable row level security;
alter table public.work_items enable row level security;
alter table public.decisions enable row level security;

create policy authority_owner on public.authority for all
  using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy authority_rules_owner on public.authority_rules for all
  using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy staff_owner on public.staff for all
  using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy inbound_owner on public.inbound_events for all
  using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy orders_owner on public.orders for all
  using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy invoices_owner on public.invoices for all
  using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy transactions_owner on public.transactions for all
  using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy work_items_owner on public.work_items for all
  using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
-- decisions are append-only: no update/delete policy
create policy decisions_read on public.decisions for select using (public.owns_workspace(workspace_id));
create policy decisions_insert on public.decisions for insert with check (public.owns_workspace(workspace_id));

alter publication supabase_realtime add table public.work_items;
