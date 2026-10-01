# FLOW-PLAN.md: NIVO operating flow ("Giao quyền → AI thực hiện → Kiểm tra kết quả → Chỉ hỏi khi cần")

Scope: `D:/starci-lanes/prototype/apps/prototype` (Next 16 App Router, Supabase Cloud, OpenRouter `deepseek/deepseek-v4-flash` via `src/lib/deepseek.ts`, deployed at nivo.vn on Netlify).

Main finding: the current product has only one kind of work unit, `executions`. It holds a follow-up draft and always waits for a human. Nothing stores the owner's authority, there is no inbound record, no dedupe, and no orders, invoices or payments. Nothing can decide between "auto" and "ask", so nothing runs by itself. The plan adds four things:
- **Authority**: the owner's goals, policies, scope and limits.
- **Inbound**: every input, with its channel, a `live`/`simulated` label and a dedupe key.
- **Work items**: one unit per step an AI department takes, which passes through a gate, can wait for a decision, and resumes.
- **Decision log**: who decided, when, how, and why.

The old `executions` and approval cards keep working. They link to work items, so an approval resumes the same piece of work.

---

## (a) Gap table

| Flow element | What exists (paths) | What's missing |
|---|---|---|
| **1. Goals** | Nothing | Revenue target, new-customer target and reply-time target per workspace, shown against real progress |
| **1. Policies (rules, reply style, brand voice)** | Each agent has `instructions`, `knowledge` and `approval_rule` (`agents` table; set in `src/features/modules/AgentSetupForm`). `deepseek.ts` hard-codes "Humans approve anything that leaves the company" in the `NIVO` prompt | Policies, reply style and brand voice at workspace level, injected into every AI prompt (`customerChat`, `draftFollowUp`, `agentReply`) |
| **1. Automation scope** | Free text `agents.approval_rule`, which nothing enforces | Rules per department and action: `auto` / `ask` / `never` |
| **1. Limits** | Nothing | `limit_vnd` and `required_fields` on each rule, enforced on the server |
| **2. Customers** | `leads` (`contact_name`, `company`, `channel`, `need`) | Phone and email for dedupe, plus an `origin` label (live or simulated) |
| **2. Messages (website, Facebook, Zalo, email)** | Website: the Chatbot "customer" tab (`src/features/agent-chat/**`, `sendAgentMessage` → `ai.customerChat` → `captureLead` in `src/lib/actions.ts`), with real AI replies but labelled "Simulated customer channel". Zalo, Facebook and email: only as seed channel strings in `src/lib/seed.ts` | An `inbound_events` table (channel, kind, origin, dedupe key). A clearly labelled **inbound simulator** for Zalo, Facebook, email and bank. Website chat counted as `live` |
| **2. Leads / orders** | Leads come from the Chatbot or `createLead` | An `orders` table, and order intake from inbound |
| **2. Invoices / transactions** | Accounting is only a responsibility row with the text "Prepare invoice" (`recordOutcome` in `actions.ts`) | `invoices` and `transactions` tables, payment intake and reconciliation |
| **3. Chatbot AI** (advise, customer care, hand off lead) | `customerChat` replies and captures a lead. `captureLead` → `buildContext` → `proposeOwner` (Sales) | The handoff is not a governed step (no gate). No "needs human" path when a customer asks for price or commitments. No human takeover |
| **3. Sales AI** (classify, follow up, close) | `proposeResponsibility` and `draftFollowUp` (always wait for approval). The stage is only changed manually through `recordOutcome` | Classification with a confidence score, auto follow-up inside scope, order confirmation, and sending care back to the Chatbot |
| **3. Accounting AI** (read documents, reconcile, record) | A responsibility row only. The seed says "Coming soon" in places | Issuing invoices, matching payments to invoices, recording payments |
| **3. NIVO CORE** (permission check, dedupe, evidence, audit) | `events` is append-only (RLS: select and insert only). `owns_workspace` RLS | A permission gate, dedupe keys for inbound and for work, `evidence_state`, and a decision log |
| **4. Routine work → AI completes it** | Nothing. Every draft waits (`executions.status='pending_approval'`) | `evaluateGate` → auto-perform → log with `decider_kind='policy'` |
| **4. Ask a human with NIVO's proposal** | Office `ApprovalBubble` (`src/features/office/approvals.tsx`) and `src/features/approval-card/**` for drafts only | An exception card per reason (missing data / over authority / unclear), with NIVO's proposal and fields for the missing data |
| **4. Continue after the decision** | `decideExecution` marks the item done and stops | `resumeWork` performs the same work item with the human's edits, then continues the chain (for example order → invoice) |
| **4. Staff are optional** | Only the owner exists | A light `staff` list, assigning an exception to a staff member, and taking over a website conversation (the AI goes quiet) |
| **5. Dashboard overview** | `/dashboard` → `src/features/overview/**` (responsibility counts, pipeline, activity) | Governance blocks |
| **5. Real results** | Lead counts only | Confirmed, invoiced and collected VND; new and won customers; auto vs asked counts, each with a source label (simulated share) |
| **5. Pending decisions** | Count of pending executions (`overview/queries.ts`, `shell/queries.ts`) | Must also include waiting work items, counted once |
| **5. Exceptions needing attention** | Nothing | Counts by reason, plus failed items |
| **5. Decision history** | `executions.decided_by/decided_at`, plus lead-scoped `events` | A `/decisions` page covering human and policy decisions, filterable |
| **Office optimistic send** | `OfficeMessenger.onSend` (`src/features/office/index.tsx`) clears the draft and only calls `append(result.data)` once the AI reply has returned | Append a local bubble at once, then reconcile it with the realtime insert or the action result |

---

## (b) Data model: new additive migration

File: `supabase/migrations/20260930120000_nivo_operating_flow.sql` (additive only; the existing migration is not touched). Push with `supabase db push` to the cloud project.

```sql
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
```

**Default rules.** These are inserted by `ensureFlowDefaults`, in VND:

| department.action | mode | limit_vnd | required_fields |
|---|---|---|---|
| chatbot.reply_customer | auto | none | none |
| chatbot.handoff_lead | auto | none | `contact_name`, `need` |
| sales.classify_lead | auto | none | none (unclear if confidence < 0.6) |
| sales.send_follow_up | ask | none | `contact` |
| sales.send_quote | ask | none | `amount_vnd` |
| sales.confirm_order | auto | 20,000,000 | `customer`, `items`, `amount_vnd` |
| sales.send_care | auto | none | none |
| accounting.issue_invoice | auto | 20,000,000 | `customer`, `amount_vnd` |
| accounting.reconcile_payment | auto | 50,000,000 | `amount_vnd` (unclear unless exactly one matching invoice) |

The owner changes any of these on `/authority`.

---

## (c) The core engine (Lane 1, `src/lib/**`)

### Files
- `src/lib/flow-types.ts`: pure types (the contract; see (e)).
- `src/lib/policy.ts`: pure, with no I/O, so it can be unit-tested. Exports `evaluateGate`, `DEFAULT_RULES` and `FLOW_NEXT`.
- `src/lib/core.ts` (`server-only`): NIVO CORE. Exports `dedupeKey`, `normaliseContact`, `ingest`, `matchLead`, `logDecision`, `logEvidence`.
- `src/lib/engine.ts` (`server-only`): `runWork`, `resumeWork`, the performers, `continueChain` and `runQueued`.
- `src/lib/flow-actions.ts` (`"use server"`): the actions the UI calls.
- `src/lib/flow-queries.ts` (`server-only`): the reads the UI uses.
- `src/lib/flow-seed.ts` (`server-only`): `ensureFlowDefaults(supabase, ws, ownerName, locale)`. Called from `session.ts` for every workspace (cheap check on whether an `authority` row exists). This backfills the demo workspace that already lives on the cloud.

### Policy gate (pure)
```ts
export const evaluateGate = (input: GateInput): GateVerdict
```
The checks run in precedence order. All reasons are collected; the first one becomes `reason`.
1. If there is no rule, or `rule.mode === 'never'`: `ask`, `not_allowed` ("Chưa được giao quyền cho việc này").
2. If `proposal.fields[f]` is empty for any field in `rule.required_fields`: `ask`, `missing_data`, with `missing=[...]`.
3. If `proposal.amount_vnd > rule.limit_vnd`: `ask`, `over_authority`. The exception: `input.priorApproval?.amount_vnd` covers the amount. This is how the owner approving an order lets Accounting issue that invoice without asking again.
4. If `proposal.confidence < 0.6`, or `proposal.outcome === 'unclear'`, or `proposal.candidates` has a length other than 1 (reconcile): `ask`, `unclear_outcome`.
5. If `rule.mode === 'ask'` and there is no `humanApproved`: `ask`, `over_authority` ("Ngoài phạm vi tự động").
6. Otherwise: `auto`, `routine`.

When a human has approved (`humanApproved: true`), checks 3 and 5 are skipped. Check 2 still applies, because approving cannot supply missing data. Check 4 is skipped only if the human chose a candidate.

### `runWork` (the one entry point for every AI step)
```ts
runWork(db, ws, spec: WorkSpec, actor: string): Promise<WorkItem>
```
1. **Dedupe.** Insert `work_items` with `spec.dedupeKey`, using on-conflict-do-nothing. If it already exists, return the existing row and log the event `core.duplicate_blocked`.
2. **Prepare** `proposal` through the action's `prepare()`. This may make one LLM call, and injects the authority brief.
3. **Gate.** Load the rule, then call `evaluateGate`.
4. **If auto:** `perform()`, then set `status='done'`, `decided_path='auto'`, and the evidence state. Then `logDecision(decider_kind='policy', decided_by='NIVO', outcome='auto_done')`, log the event (`work.auto_done`, with evidence), post one short system line in Office, and call `continueChain(item)`.
5. **If ask:** set `status='waiting_decision'`, `reason`, `reasons`, `missing_fields` and `proposal`. Log the event `work.asked`. Insert an Office message with `work_item_id` so the thread shows it. For `send_follow_up`, also insert an `executions` row (`pending_approval`, `work_item_id`) so the existing `ApprovalBubble` and lead-detail cards keep working.
6. **On exception:** set `status='failed'` and `error`, and log the event. Failed items count as exceptions.

### `resumeWork` (the decision resumes the same work)
```ts
resumeWork(db, ws, workItemId, decision: 'approved'|'rejected', edits: WorkEdits, by: {name, kind:'owner'|'staff'}): Promise<WorkItem>
```
1. **Guarded transition.** Run `update work_items set status='queued' where id=? and status='waiting_decision' returning *`. If no row comes back, throw "Việc này đã được quyết định", which makes double-clicks safe.
2. **Merge.** `proposal = {...proposal, ...edits}`. `outcome` is `edited` if anything changed, otherwise `approved`.
3. **Rejected:** set `status='rejected'`, `logDecision(outcome='rejected')`, then run the action's `onReject` (for example, Sales re-opens the responsibility or the order is cancelled). Stop.
4. **Approved:** run `evaluateGate({..., humanApproved:true})`. If data is still missing, revert to `waiting_decision` and throw a message naming the missing fields. Otherwise `perform()`, `logDecision(decider_kind=by.kind, outcome)`, then `continueChain(item, { priorApproval:{amount_vnd} })`. **This is the "NIVO tiếp tục đúng công việc cũ" step.**
5. `decideExecution` in `actions.ts` changes: if `ex.work_item_id` is set, it delegates to `resumeWork`.

### Chain (`FLOW_NEXT` in `policy.ts`)
```
inbound message/lead ─► chatbot.handoff_lead ─► sales.classify_lead ─► sales.send_follow_up
inbound order        ─► sales.confirm_order ─► accounting.issue_invoice
inbound payment      ─► accounting.reconcile_payment ─► sales.send_care ─► (Chatbot conversation)
recordOutcome(won)   ─► accounting.issue_invoice (no amount ⇒ missing_data demo)
website chat (live)  ─► chatbot.reply_customer inline; needs_human ⇒ work item (unclear/over_authority)
```

### Performers (honest effects)

| Action | prepare | perform |
|---|---|---|
| `handoff_lead` | fields from inbound or chat | `matchLead` by phone, email, or name+channel. Create the lead if none matches, with `origin`. Context brief. Responsibility owned by Sales |
| `classify_lead` | `ai.classifyLead` returns `{stage, confidence, next_action, missing}` | Update `leads.stage` and the responsibility's `next_action` |
| `send_follow_up` | `ai.draftFollowUp` with the authority brief | If the lead has a website conversation, insert an agent message into it: real delivery, evidence `captured`. Otherwise record "Đã ghi nhận — kênh Zalo/Facebook đang mô phỏng, chưa gửi thật", evidence `captured`, and label it as simulated |
| `confirm_order` | structured fields from the simulator. `ai.extractOrder` runs only when text has no amount | `orders.status='confirmed'`, `lead.stage='won'` |
| `issue_invoice` | amount from the order, due date +15 days | Insert an invoice (`INV-YYYYMM-####`, `status='issued'`), labelled "Hóa đơn nội bộ (chưa phát hành HĐĐT)". `orders.status='invoiced'` |
| `reconcile_payment` | candidates = issued invoices whose number appears in the reference, or whose amount equals the payment exactly | `transactions.matched`, `invoices.paid`, `orders.paid`, evidence `verified` |
| `send_care` | `ai.draftCare` | Same as `send_follow_up` (Sales hands the care message to the Chatbot conversation) |
| `reply_customer` | `customerChat` now returns `{reply, lead, needs_human, reason}` | Reply is always posted. If `needs_human`, the reply says a person will confirm, and a work item is created carrying the proposed answer. Approving it posts the answer into the conversation. If `agent_conversations.handled_by` is set, the AI does not reply |

### LLM and time budget
Netlify function timeouts are about 10–26 s. Rules:
- Each request makes at most one LLM call inline.
- Every further chain step is inserted as `status='queued'` and processed by `runQueued(ws, limit=2)`. That is called from `after()` (`next/server`) at the end of each flow action, and also as a fallback from `flow-queries.getGovernance()` and the Office page loader through `after()`.
- Deterministic steps (confirm, invoice, reconcile) need no LLM, so the order → invoice → payment demo is fast and reliable.

### `deepseek.ts` changes
- Add `authorityBrief(a: Authority)`, appended to the persona in `customerChat`, `testChat`, `draftFollowUp` and `agentReply`.
- Change the `NIVO` preamble to "Act within the authority the owner granted; ask when data is missing, the action is over the limit, or the outcome is unclear."
- New functions: `classifyLead`, `extractOrder`, `draftCare`.
- `customerChat` gains `needs_human` and `reason` in its output.

The brand and agent briefs still say "Humans approve everything that leaves the company". The owner's new flow replaces that rule, so update the wording in BRAND-V1.1 and AGENTS-BRIEF to: "Humans approve anything outside the authority they granted."

---

## (d) UI changes per route

| Route | Lane | Change |
|---|---|---|
| **`/authority` (new, "Giao quyền")** | L2 | Page header, then four sections matching the image: **Mục tiêu** (revenue VND, new customers, first reply minutes, note), **Chính sách** (rules, reply style, brand voice), **Phạm vi tự động** (department × action table with segmented Auto / Hỏi trước / Không bao giờ plus the limit in VND), **Giới hạn** (plain note plus required-field chips per rule). One primary "Lưu" per section. Below: "Nhân viên (tùy chọn)", a staff list with add and deactivate |
| **`/inbox` (new, "Đầu vào")** | L2 | Top: a permanent warning `Alert`: "Zalo, Facebook, Email, Ngân hàng: đang **mô phỏng** — chưa kết nối thật. Website chat là thật (qua Chatbot)." A simulator form (channel, kind message/order/payment, sender name, phone/email, text, amount, reference) with **one** primary "Gửi vào NIVO". Result line: "Đã nhận → Sales AI xử lý" or "Trùng lặp — NIVO đã bỏ qua (lần n)". Feed of inbound events with channel, a Mô phỏng/Thật badge, status, a link to the resulting work, and the duplicate count |
| **`/chat` Office** | L3 | (1) Optimistic send (below). (2) `ExceptionCard` in the thread for waiting work items that have no `execution_id`: department avatar, reason chip (Thiếu dữ kiện / Vượt quyền / Chưa rõ kết quả / Chưa được giao quyền), "NIVO đề xuất" text, inputs for `missing_fields`, candidate picker for reconcile, then "Đồng ý để NIVO tiếp tục" (primary), "Sửa rồi tiếp tục", "Từ chối", and "Giao cho nhân viên" (optional select). After the decision, the card shows "Đã quyết định bởi X lúc Y → NIVO đã tiếp tục: …" from `result`. (3) The header chip counts `pendingDecisions` (approvals plus exceptions). (4) The info panel gets a "Ngoại lệ" section. (5) Realtime subscription on `work_items` for live cards |
| **Office optimistic fix** | L3 | In `onSend`, create `local-${crypto.randomUUID()}` with `author_kind:'human'`, `author_name:userName`, the body and `created_at: now`, and add a `pending` flag in local state (not on `Message`). Append it immediately. In `append`, when an incoming message is human, from `userName` and has the same body, remove the oldest matching `local-*` entry. On error, remove the local entry and restore the draft. Render the pending bubble with "Đang gửi…" and failures with "Chưa gửi được · Thử lại" |
| **`/dashboard`** | L4 | Governance first, promo last. (1) **Tổng quan**: one sentence ("Hôm nay NIVO tự hoàn thành n việc, hỏi bạn m việc") plus three department tiles (Chatbot → Sales → Kế toán) with done-in-7-days and waiting counts. (2) **Kết quả thật**: confirmed / invoiced / collected VND against the goal, new and won customers; every figure has context and a source line such as "k/n từ dữ liệu mô phỏng". (3) **Việc đang chờ**: count and the top 3, linking to Office. (4) **Ngoại lệ cần chú ý**: counts by reason plus failed. (5) **Lịch sử quyết định**: the last 5 (who / when / outcome), linking to `/decisions`. Keep the existing owner groups beneath |
| **`/decisions` (new)** | L4 | A list (not a table on mobile) of `decisions`: time, department, action, decider ("NIVO · theo chính sách" or a person), outcome badge, reason, note, and a lead link. Filters: Tất cả / Tự động / Con người / Từ chối, and department |
| **Shell nav** | L4 | Order: Office, Tổng quan, **Giao quyền**, **Đầu vào**, Khách hàng, Việc, **Lịch sử quyết định**, Module. The Office badge equals `pendingDecisions` |
| **`/leads/[id]`** | L5 | A "Dòng chảy" panel: this lead's work items in order, showing department, status, gate reason and evidence state; plus orders, invoices and transactions, and the lead's decisions. A Mô phỏng badge when `origin='simulated'` |
| **`/modules/[id]/chat`** | L5 | For the Chatbot customer tab, retitle to "Website chat (AI thật — bạn đóng vai khách)". Add a "Tiếp quản hội thoại" / "Trả lại cho AI" toggle; while taken over, the composer sends as the staff member and the AI is silent. Show the system line "Đã chuyển lead cho Sales AI" together with the gate verdict |

---

## (e) Parallel lanes, ownership and contracts

### Ownership (strict; everything else is read-only for that lane)

| Lane | Owns |
|---|---|
| **L1 Core** | `supabase/migrations/20260930120000_nivo_operating_flow.sql`, `src/lib/**` (all, including `actions.ts`, `deepseek.ts`, `seed.ts`, `session.ts`, new `flow-*.ts`, `policy.ts`, `core.ts`, `engine.ts`), `src/i18n/dict/system.ts`, **new** `src/i18n/dict/governance.ts` (shared labels) |
| **L2 Authority + Inbox** | `src/app/(console)/authority/**`, `src/app/(console)/inbox/**`, `src/features/authority/**`, `src/features/inbox/**`, dicts `authority.ts`, `inbox.ts` |
| **L3 Office** | `src/app/(console)/chat/**`, `src/features/office/**`, dict `office.ts` |
| **L4 Governance** | `src/app/(console)/dashboard/**`, `src/features/overview/**`, `src/app/(console)/decisions/**`, `src/features/decisions/**`, `src/features/shell/**`, `src/app/(console)/layout.tsx`, dicts `overview.ts`, `shell.ts`, `decisions.ts` |
| **L5 Leads, agent chat, UAT** | `src/features/lead-detail/**`, `src/app/(console)/leads/[id]/**`, `src/features/agent-chat/**`, `src/app/(console)/modules/[agentId]/chat/**`, dicts `lead.ts`, `agentChat.ts`, `scripts/uat-flow.mjs` |

**Sequencing.** L1 writes the **contract files first**, within its first step: `flow-types.ts`, `governance.ts`, and `flow-actions.ts` / `flow-queries.ts` with full signatures whose bodies throw `"not implemented"`. That way L2–L5 compile against them from the start. Other lanes code against the signatures below and never edit L1 files. The migration is pushed to cloud by the integrator after L1 is done.

### Interface contract (written by L1 exactly like this)

`src/lib/flow-types.ts`
```ts
export type Department = "chatbot" | "sales" | "accounting";
export type FlowAction = "reply_customer" | "handoff_lead" | "classify_lead" | "send_follow_up" | "send_quote"
  | "confirm_order" | "send_care" | "issue_invoice" | "reconcile_payment";
export type RuleMode = "auto" | "ask" | "never";
export type ReasonCode = "routine" | "missing_data" | "over_authority" | "unclear_outcome" | "not_allowed";
export type WorkStatus = "queued" | "done" | "waiting_decision" | "rejected" | "failed";
export type EvidenceState = "pending" | "captured" | "reviewed" | "verified" | "customer_confirmed";
export type Origin = "live" | "simulated";
export type InboundChannel = "website" | "facebook" | "zalo" | "email" | "phone" | "bank" | "manual";
export type InboundKind = "message" | "lead" | "order" | "invoice" | "payment";

export type Authority = { workspace_id: string; goal_revenue_vnd: number | null; goal_new_customers: number | null;
  goal_first_reply_minutes: number | null; goal_note: string; policies: string; reply_style: string; brand_voice: string;
  limits_note: string; updated_by: string | null; updated_at: string };
export type AuthorityRule = { id: string; workspace_id: string; department: Department; action: FlowAction; mode: RuleMode;
  limit_vnd: number | null; required_fields: string[]; note: string; updated_at: string };
export type Staff = { id: string; workspace_id: string; name: string; role: string; email: string | null; active: boolean; created_at: string };
export type InboundEvent = { id: string; workspace_id: string; channel: InboundChannel; kind: InboundKind; origin: Origin;
  sender_name: string | null; sender_contact: string | null; body: string; amount_vnd: number | null; external_ref: string | null;
  dedupe_key: string; duplicate_count: number; last_duplicate_at: string | null; lead_id: string | null;
  status: "received" | "processed" | "needs_decision" | "failed"; created_at: string };
export type Order = { id: string; workspace_id: string; lead_id: string | null; order_no: string; items: string; amount_vnd: number | null;
  status: "draft" | "confirmed" | "invoiced" | "paid" | "cancelled"; origin: Origin; confirmed_by: string | null; confirmed_at: string | null; created_at: string };
export type Invoice = { id: string; workspace_id: string; order_id: string | null; lead_id: string | null; invoice_no: string; amount_vnd: number;
  due_at: string | null; status: "draft" | "issued" | "paid" | "void"; origin: Origin; issued_by: string | null; issued_at: string | null; paid_at: string | null; created_at: string };
export type Transaction = { id: string; workspace_id: string; channel: "bank" | "cash" | "card" | "ewallet"; amount_vnd: number; reference: string | null;
  payer: string | null; occurred_at: string; invoice_id: string | null; status: "unmatched" | "matched" | "needs_review"; origin: Origin; created_at: string };
export type Proposal = { summary: string; draft?: string; amount_vnd?: number | null;
  fields: Record<string, string | number | null>; confidence?: number; outcome?: "clear" | "unclear";
  candidates?: Array<{ id: string; label: string; amount_vnd: number }> };
export type WorkItem = { id: string; workspace_id: string; department: Department; action: FlowAction;
  subject_type: "lead" | "order" | "invoice" | "transaction" | "conversation" | "inbound"; subject_id: string | null;
  lead_id: string | null; inbound_event_id: string | null; parent_id: string | null; status: WorkStatus;
  decided_path: "auto" | "human" | null; reason: ReasonCode | null; reasons: string[]; missing_fields: string[];
  proposal: Proposal; result: { summary: string; href?: string } | null; error: string | null; evidence_state: EvidenceState;
  assigned_staff_id: string | null; execution_id: string | null; origin: Origin; created_at: string; updated_at: string; completed_at: string | null };
export type WorkItemView = WorkItem & {
  lead: { id: string; contact_name: string; company: string; channel: string } | null;
  assignedStaffName: string | null;
  /** true when a legacy execution approval card already renders this item (Office must not render it twice) */
  hasApprovalCard: boolean;
  href: string };
export type DecisionRow = { id: string; work_item_id: string | null; lead_id: string | null; leadName: string | null;
  department: Department; action: FlowAction; decided_by: string; decider_kind: "policy" | "owner" | "staff";
  outcome: "auto_done" | "approved" | "edited" | "rejected"; reason: ReasonCode | null; note: string | null; created_at: string };
export type GateInput = { department: Department; action: FlowAction; rule: AuthorityRule | null; proposal: Proposal;
  humanApproved?: boolean; priorApproval?: { amount_vnd: number | null } };
export type GateVerdict = { verdict: "auto" | "ask"; reason: ReasonCode; reasons: ReasonCode[]; missing: string[] };
export type WorkEdits = { draft?: string; amount_vnd?: number | null; fields?: Record<string, string | number | null>; candidateId?: string };
export type Governance = {
  goals: { revenueVnd: number | null; newCustomers: number | null; firstReplyMinutes: number | null };
  results: { confirmedVnd: number; invoicedVnd: number; collectedVnd: number; ordersConfirmed: number;
    newCustomers7d: number; wonCustomers: number; simulated: number; total: number };
  efficiency: { autoDone7d: number; askedHuman7d: number; medianDecisionMinutes: number | null };
  pendingDecisions: number; // waiting work_items + pending executions with no work_item_id (counted once)
  exceptions: Record<ReasonCode | "failed", number>;
  departments: Array<{ department: Department; done7d: number; waiting: number; lastActivityAt: string | null }>;
  recentDecisions: DecisionRow[] };
export type SimulateInboundInput = { channel: Exclude<InboundChannel, "website">; kind: InboundKind; sender_name: string;
  sender_contact?: string; body?: string; amount_vnd?: number | null; external_ref?: string; items?: string };
export type LeadFlow = { workItems: WorkItemView[]; orders: Order[]; invoices: Invoice[]; transactions: Transaction[]; decisions: DecisionRow[] };
```

`src/lib/flow-queries.ts` (`server-only`, workspace from `getSession`)
```ts
getAuthority(): Promise<Authority>
listRules(): Promise<AuthorityRule[]>
listStaff(): Promise<Staff[]>
listInbound(limit?: number): Promise<InboundEvent[]>
listExceptions(): Promise<WorkItemView[]>                      // status waiting_decision + failed, oldest first
listWorkItems(filter?: { status?: WorkStatus[]; leadId?: string; limit?: number }): Promise<WorkItemView[]>
listDecisions(filter?: { kind?: "policy" | "human" | "rejected"; department?: Department; limit?: number }): Promise<DecisionRow[]>
getGovernance(): Promise<Governance>
getLeadFlow(leadId: string): Promise<LeadFlow>
```

`src/lib/flow-actions.ts` (`"use server"`, all return `Outcome<T>`)
```ts
saveAuthority(patch: Partial<Omit<Authority, "workspace_id" | "updated_by" | "updated_at">>): Promise<Outcome<Authority>>
saveRule(input: { department: Department; action: FlowAction; mode: RuleMode; limit_vnd: number | null; required_fields?: string[]; note?: string }): Promise<Outcome<AuthorityRule>>
saveStaff(input: { id?: string; name: string; role: string; email?: string | null; active?: boolean }): Promise<Outcome<Staff>>
simulateInbound(input: SimulateInboundInput): Promise<Outcome<{ event: InboundEvent; duplicate: boolean; workItem: WorkItem | null }>>
decideWorkItem(workItemId: string, decision: "approved" | "rejected", edits?: WorkEdits, note?: string): Promise<Outcome<WorkItem>>
assignWorkItem(workItemId: string, staffId: string | null): Promise<Outcome<WorkItem>>
takeOverConversation(conversationId: string, take: boolean): Promise<Outcome<{ handled_by: string | null }>>
sendAsHuman(conversationId: string, body: string): Promise<Outcome<AgentMessage>>   // while taken over
```
Unchanged exports in `actions.ts` keep their signatures. `decideExecution` and `recordOutcome` now route through the engine internally.

`src/i18n/dict/governance.ts` (shared labels; UI lanes import them, only L1 edits): keys `dept_chatbot|dept_sales|dept_accounting`, `action_<FlowAction>`, `reason_<ReasonCode>`, `reasonHint_<ReasonCode>`, `status_<WorkStatus>`, `evidence_<EvidenceState>`, `origin_live`, `origin_simulated`, `channel_<InboundChannel>`, `mode_auto|mode_ask|mode_never`, `decider_policy`, `outcome_<outcome>`, `field_<name>` (`contact_name`, `need`, `contact`, `customer`, `items`, `amount_vnd`), `motto`.

Realtime: `work_items` is added to the publication (L3 subscribes to INSERT/UPDATE filtered by `workspace_id`).

### Ready-to-paste prompts

Common header for every lane (prepend it):
> Worktree `D:/starci-lanes/prototype/apps/prototype`. Read `AGENTS-BRIEF.md`, `BRAND-V1.1.md`, `UX-BRIEF.md`, `UI-RULEBOOK.md`, `I18N-AUDIT-BRIEF.md`, `FLOW-PLAN.md` (sections b–e), and look at `design-refs/nivo-operating-flow.webp` with the Read tool. Edit ONLY the files your lane owns (FLOW-PLAN §e). Do not use git, do not run npm install, do not reset the DB. Every string goes through i18n dicts with vi (default) and en. No invented metrics: every figure comes from a query, and simulated data is labelled. Verify with `npx tsc --noEmit -p .` plus screenshots via `MSYS_NO_PATHCONV=1 SHOT_LOCALE=vi node scripts/shot.mjs ../../.shots/<id> /route` at 1440 and 390, in vi and en. Final report: files changed, screenshots, anything you need from another lane.

**L1 Core engine**
> You own the migration and `src/lib/**`, plus dicts `system.ts` and the new `governance.ts`.
> STEP 0, first and fast: create `src/lib/flow-types.ts` exactly as in FLOW-PLAN §e, `src/i18n/dict/governance.ts` with all keys, and `src/lib/flow-queries.ts` / `src/lib/flow-actions.ts` with the exact signatures, bodies throwing `new Error("not implemented")`. Run tsc so other lanes can compile.
> Then:
> (1) `supabase/migrations/20260930120000_nivo_operating_flow.sql` exactly per §b. Additive only; apply locally with `npx supabase migration up` (not reset).
> (2) `src/lib/policy.ts`: pure `evaluateGate`, `DEFAULT_RULES`, `FLOW_NEXT` per §c. Add a tiny self-check script `scripts/policy-check.mjs` or inline asserts covering all 5 reasons, priorApproval and humanApproved. L1 also owns this script.
> (3) `src/lib/core.ts`: `normaliseContact` (VN phone → `84…` digits, lowercased email); `dedupeKey(channel, kind, contact|name, external_ref ?? sha1(normalised body)[:16], yyyy-mm-dd)`; `ingest()` (insert into `inbound_events` on conflict do nothing; on duplicate, increment `duplicate_count` and log `core.duplicate_blocked`); `matchLead`; `logDecision`; `logEvidence` (events with `work_item_id`).
> (4) `src/lib/engine.ts`: `runWork`, `resumeWork` (guarded status transition), `continueChain`, `runQueued`, and the performers exactly as in §c, including the honest labels on simulated delivery. Keep inline LLM calls to at most one per request; queue the rest and drain with `after()` from `next/server`.
> (5) Wire the existing actions in `actions.ts`: `captureLead`/`createLead` → ingest + `runWork(chatbot.handoff_lead)` (website chat is `origin:'live'`); `draftExecution` → `runWork(sales.send_follow_up)` (create the execution only when asking; on auto, insert the execution as approved by `NIVO`); `decideExecution` → `resumeWork` when `work_item_id` is set; `recordOutcome(won)` → `runWork(accounting.issue_invoice)`, which has no amount and so asks with missing_data; `sendAgentMessage` respects `handled_by` and the `needs_human` path; `sendTeamMessage` unchanged except that the brief includes waiting exceptions.
> (6) `deepseek.ts`: `authorityBrief`, new preamble, `classifyLead`, `extractOrder`, `draftCare`, and `customerChat` returning `needs_human`/`reason`.
> (7) `src/lib/flow-seed.ts` `ensureFlowDefaults`, called from `session.ts` for every session (one cheap select). It inserts the authority row and default rules. If `demo_seeded_at` is null, it also adds demo examples all labelled `origin:'simulated'`: one Zalo message → auto chain done; one Facebook order of 45,000,000 VND waiting over_authority; Customer D's invoice waiting missing_data; one bank payment with an unknown reference waiting unclear_outcome; and the matching decisions. Also call it from `seedWorkspace` for new workspaces.
> (8) Implement `flow-queries.ts` and `flow-actions.ts`. `pendingDecisions` counts once. `listExceptions` sets `hasApprovalCard = execution_id !== null`.
> Everything written into the DB as text goes through `getT(system)` with vi and en.

**L2 Authority + Inbox**
> Build `/authority` ("Giao quyền") and `/inbox` ("Đầu vào") per FLOW-PLAN §d, using `getAuthority`, `listRules`, `listStaff`, `listInbound` from `@/lib/flow-queries` and `saveAuthority`, `saveRule`, `saveStaff`, `simulateInbound` from `@/lib/flow-actions`. Labels come from `@/i18n/dict/governance`; your own copy goes in the new dicts `authority.ts` and `inbox.ts`.
> `/authority`: four sections in the order of the image (Mục tiêu, Chính sách, Phạm vi tự động, Giới hạn), plus the optional staff list. The rule table is grouped by department (Chatbot AI, Sales AI, Kế toán AI), with a segmented mode control and a VND limit input formatted with `Intl.NumberFormat('vi-VN')`. Each section has its own save with isPending and an inline error. Show the motto line under the header.
> `/inbox`: a permanent simulated-channels `Alert`. The simulator form uses stable accessible labels: "Kênh", "Loại", "Tên khách", "Điện thoại hoặc email", "Nội dung", "Số tiền (VND)", "Mã tham chiếu", and the button "Gửi vào NIVO". Show a result line naming duplicate vs received and linking to the lead or Office. The feed shows a Mô phỏng/Thật badge on every row. Include a one-click preset row: "Tin Zalo mới", "Đơn Facebook 5 triệu", "Đơn Facebook 45 triệu", "Đơn thiếu số tiền", "Chuyển khoản không rõ mã". Presets only fill the form; the user still presses send.
> Mobile 390 with no horizontal scroll. Nav entries are added by L4; do not touch the shell.

**L3 Office**
> In `src/features/office/**` and `src/app/(console)/chat/**`:
> (1) Optimistic send exactly per FLOW-PLAN §d: a local bubble shows immediately with "Đang gửi…", is reconciled with the realtime insert or the action result, and on failure the draft is restored and the bubble is marked as failed. Add `data-testid="msg-pending"` on pending bubbles.
> (2) Load `listExceptions()` in the page. Render `ExceptionCard` (new `src/features/office/exceptions.tsx`) inside the thread timeline (extend `timeline.ts`, sorted by `created_at`) for items with `hasApprovalCard === false`. Content: reason chip, "NIVO đề xuất", inputs for missing fields, candidate picker, and the buttons "Đồng ý để NIVO tiếp tục" (the only primary), "Sửa rồi tiếp tucc" is NOT a label: use "Sửa rồi tiếp tục", "Từ chối", and "Giao cho nhân viên". These call `decideWorkItem` / `assignWorkItem`. After the decision the card shows who, when, and `result.summary`.
> (3) The header chip and info panel use `pendingDecisions` (approvals plus exceptions); the info panel adds a "Ngoại lệ" list with jump-to-card.
> (4) Subscribe to realtime `work_items` INSERT/UPDATE for this workspace and call `router.refresh()`, debounced.
> Keep the existing ApprovalBubble behaviour.

**L4 Governance (dashboard, decisions, shell)**
> (1) `/dashboard`: rebuild `src/features/overview/**` around `getGovernance()` with the five blocks in FLOW-PLAN §d (Tổng quan with the Chatbot → Sales → Kế toán tiles; Kết quả thật; Việc đang chờ; Ngoại lệ cần chú ý; Lịch sử quyết định). Every figure has a label, value, context and source, e.g. "3/5 từ dữ liệu mô phỏng". Show goals as "đạt x / mục tiêu y" only when a goal is set; otherwise link "Đặt mục tiêu" → `/authority`. VND uses `Intl` vi-VN. Keep the owner groups below, and keep the promo as the last block.
> (2) New `/decisions` page (`src/app/(console)/decisions/page.tsx`, `src/features/decisions/**`) using `listDecisions(filter)`, with query-string filters (`?kind=policy|human|rejected&dept=`).
> (3) Shell: add nav entries Giao quyền `/authority`, Đầu vào `/inbox`, Lịch sử quyết định `/decisions` (check the real `IconName` union in `packages/ui`). The Office badge and bell use `getGovernance().pendingDecisions`, and the bell list includes exceptions (from `listExceptions`).
> Use stable headings: "Kết quả thật", "Việc đang chờ", "Ngoại lệ cần chú ý", "Lịch sử quyết định" (and the en equivalents).

**L5 Leads, agent chat, UAT**
> (1) Lead page: add a "Dòng chảy công việc" panel (`src/features/lead-detail/flow/index.tsx`, composed in `leads/[id]/page.tsx`) using `getLeadFlow(leadId)`: work items in order (department, action, status, reason, evidence state), orders, invoices and payments with VND amounts, decisions, and a Mô phỏng badge.
> (2) Agent chat customer tab: retitle it honestly as real AI with you playing the visitor; add "Tiếp quản hội thoại" / "Trả lại cho AI" (`takeOverConversation`); while taken over the composer uses `sendAsHuman`; show handoff and gate system lines.
> (3) Write `scripts/uat-flow.mjs` per FLOW-PLAN §f, reusing the helpers in `scripts/uat-video.mjs` (do not edit that file).

---

## (f) UAT journey: `scripts/uat-flow.mjs` (Playwright, headless, deployed site)

Usage: `BASE_URL=https://nivo.vn UAT_LOCALE=vi node scripts/uat-flow.mjs ../../.shots/uat-flow`. The pattern is the same as `uat-video.mjs`: scenes, the `check()` helper, video per scene, and `uat-report.json`.

**Non-destructive policy:**
- A run tag `RUN = "UAT-" + Date.now().toString(36)` goes into every sender name, and a unique phone `09${random 8 digits}`.
- The script only decides work items whose lead or sender contains `RUN`. It never touches seeded items and never changes authority settings.
- Created data stays in the demo workspace, visibly labelled Mô phỏng and tagged with `RUN`.

**Scenes and assertions:**

0. **Login.** Click the demo button; the URL leaves `/login`.

1. **Giao quyền.** `goto /authority`.
   - Headings "Mục tiêu", "Chính sách", "Phạm vi tự động" and "Giới hạn" are visible.
   - The rule row "Xác nhận đơn hàng" has a mode (Tự động / Hỏi trước / Không bao giờ) and a numeric limit. The script reads the limit `L` (expected default 20,000,000).
   - The staff section shows "tùy chọn".
   - No save is performed.

2. **Nhận đầu vào.** `goto /inbox`.
   - The Alert contains "mô phỏng".
   - Submit Zalo / Tin nhắn from `Khách ${RUN}`, the run's phone, and the text "Cần tư vấn gói chăm sóc khách hàng". The result says "Đã nhận". The feed's first row contains `RUN`, "Zalo" and the "Mô phỏng" badge.
   - Submit the identical message again. The result says "Trùng lặp" and the duplicate count is at least 1.
   - (Optional, only if a Chatbot is installed) On `/modules/<chatbot>/chat` in the customer tab, the badge says "AI thật".

3. **Các bộ phận AI tự vận hành.**
   - Poll `/leads?q=${RUN}` for up to 60 s until a lead appears, then open it. The "Dòng chảy công việc" panel shows "Chatbot AI · Chuyển lead · Đã xong · Tự động" and "Sales AI · Phân loại".
   - Submit on `/inbox`: Facebook / Đơn hàng for the same phone, amount 5,000,000 (below `L`), reference `${RUN}-O1`.
   - Within 30 s the lead panel shows the order as "Đã xác nhận" and an invoice "Đã phát hành" by "Kế toán AI". On `/decisions?kind=policy` there are at least 2 rows containing `RUN` with "NIVO · theo chính sách".

4. **Tự xử lý hoặc xin quyết định.**
   - **Office optimistic send:** on `/chat`, type `@sales ${RUN} kiểm tra` and press Send. Within 1,000 ms the log contains that text (or `[data-testid=msg-pending]`), before any Sales Agent reply appears.
   - **Over authority:** submit a Facebook order of 45,000,000 with reference `${RUN}-O2`. On `/chat`, a card containing `RUN` and "Vượt quyền" appears with "NIVO đề xuất". Click "Đồng ý để NIVO tiếp tục". The card shows "Đã quyết định bởi" and the demo user's name. Without further clicks, the lead panel shows the 45,000,000 invoice issued within 30 s (priorApproval continues the same work).
   - **Missing data:** submit an order with no amount (`${RUN}-O3`). The card shows "Thiếu dữ kiện" and a "Số tiền (VND)" input. Fill in 3,000,000 and continue. The invoice for 3,000,000 appears.
   - **Unclear:** submit Bank / Thanh toán of 5,000,000 with reference `CK ${RUN} khong ro`. A card shows "Chưa rõ kết quả" with the candidate invoice selectable. Choose the `${RUN}-O1` invoice and continue. The lead panel shows that invoice as "Đã thanh toán", and a Sales AI "Gửi chăm sóc" work item appears (Sales → Chatbot).
   - **Reject path:** submit order `${RUN}-O4` of 45,000,000 and click "Từ chối". The card shows "Đã từ chối" and no invoice is created for O4.

5. **Kết quả quản trị.** `goto /dashboard`.
   - Headings "Kết quả thật", "Việc đang chờ", "Ngoại lệ cần chú ý" and "Lịch sử quyết định" are visible.
   - "Kết quả thật" shows a VND figure and the text "mô phỏng".
   - The "Việc đang chờ" number equals the Office chip's number (read both).
   - "Lịch sử quyết định" lists an entry containing `RUN` with the decider name and a relative time.
   - On `/decisions?kind=human`, rows for `RUN` show outcomes Đã duyệt, Đã sửa and Đã từ chối.
   - On `/decisions?kind=policy`, the auto rows exist.

6. **Phone (390).** `/authority`, `/inbox`, `/decisions` and `/dashboard` all have `scrollWidth ≤ 392`, and the exception card buttons are at least 40 px tall.

Report: `uat-report.json`, with pass/fail per check, the run tag, and one `.webm` per scene. Exit code non-zero if any check fails.

---

### Critical files for implementation
- D:/starci-lanes/prototype/apps/prototype/supabase/migrations/20260930120000_nivo_operating_flow.sql (new)
- D:/starci-lanes/prototype/apps/prototype/src/lib/actions.ts (wire `captureLead`, `draftExecution`, `decideExecution`, `recordOutcome` and `sendAgentMessage` into the engine; plus new `src/lib/policy.ts`, `core.ts`, `engine.ts`, `flow-types.ts`, `flow-actions.ts`, `flow-queries.ts`, `flow-seed.ts`)
- D:/starci-lanes/prototype/apps/prototype/src/lib/deepseek.ts
- D:/starci-lanes/prototype/apps/prototype/src/features/office/index.tsx (optimistic send, exception cards, realtime `work_items`)
- D:/starci-lanes/prototype/apps/prototype/src/features/overview/index.tsx (governance blocks; with `src/features/shell/index.tsx` for the new nav entries)