-- Legacy follow-up approval cards become work items (G15c, 2026-10-13).
-- Every live path opens a follow-up approval card (executions, status pending_approval) together with a sales work item that waits
-- for a decision, and the Sales workbench "waiting for you" panel now reads only those work items (the shared agent dashboard query).
-- Cards from before the operating flow (executions.work_item_id is null) would vanish from that panel, so each one gets its sales
-- send_follow_up work item here, waiting for the owner, linked both ways; deciding the card then takes the normal work-item path.
-- Idempotent: the dedupe key send_follow_up:exec:<card id> is unique per workspace, and only unlinked pending cards are read.

with legacy as (
  select x.id as execution_id, x.workspace_id, x.draft, x.created_at, r.id as responsibility_id, r.lead_id, r.next_action,
         l.contact_name
  from public.executions x
  join public.responsibilities r on r.id = x.responsibility_id
  join public.leads l on l.id = r.lead_id
  where x.status = 'pending_approval' and x.work_item_id is null
),
created as (
  insert into public.work_items (
    workspace_id, department, action, subject_type, subject_id, lead_id, dedupe_key, status, reason, reasons, proposal,
    execution_id, origin, created_at, updated_at
  )
  select
    g.workspace_id, 'sales', 'send_follow_up', 'lead', g.lead_id, g.lead_id, 'send_follow_up:exec:' || g.execution_id,
    'waiting_decision', 'routine', array['routine'],
    jsonb_build_object(
      'summary', g.next_action,
      'draft', g.draft,
      'fields', jsonb_build_object('responsibility_id', g.responsibility_id, 'customer', g.contact_name)
    ),
    g.execution_id, 'live', g.created_at, now()
  from legacy g
  on conflict (workspace_id, dedupe_key) do nothing
  returning id, execution_id
)
update public.executions x
set work_item_id = c.id
from created c
where x.id = c.execution_id;

-- Each backfilled item is the root of its own command chain, as the be intake makes it.
update public.work_items
set chain_id = id
where chain_id is null and action = 'send_follow_up' and dedupe_key like 'send_follow_up:exec:%';
