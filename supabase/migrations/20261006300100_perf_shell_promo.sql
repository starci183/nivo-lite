-- Perf: the console frame (sidebar counts, notification list, agents, promo flags) in ONE round trip instead of ~12,
-- and the promo / onboarding state of /dashboard in one instead of up to 9 (3 sequential waves).
-- SECURITY INVOKER: all reads run under the caller's RLS, so nothing leaves the caller's workspace.

-- Same test-run rule as src/lib/flow-queries.ts TEST_RUN_PATTERN (case-sensitive UAT|DBG).
create or replace function public.shell_data(ws uuid, founding_from timestamptz, founding_to timestamptz)
returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'lead_count', (select count(*) from leads where workspace_id = ws),
    'open_responsibility_count', (select count(*) from responsibilities where workspace_id = ws and status <> 'done'),
    'agents', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'module', a.module, 'status', a.status) order by a.created_at)
                        from agents a where a.workspace_id = ws), '[]'::jsonb),
    'has_chatbot', exists (select 1 from agents a where a.workspace_id = ws and a.module = 'chatbot'),
    'is_founding_member', exists (select 1 from events e where e.workspace_id = ws and e.kind = 'module.purchased'
                                  and e.created_at >= founding_from and e.created_at <= founding_to),
    -- approval cards waiting for a decision, newest first, with the customer they belong to
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'draft', x.draft, 'next_action', r.next_action,
                                                             'lead_id', l.id, 'contact_name', l.contact_name) order by x.created_at desc)
                         from executions x
                         left join responsibilities r on r.id = x.responsibility_id
                         left join leads l on l.id = r.lead_id
                         where x.workspace_id = ws and x.status = 'pending_approval'), '[]'::jsonb),
    -- work items waiting / failed that have no approval card of their own
    'exceptions', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'lead_id', w.lead_id, 'contact_name', l.contact_name,
                                                                'summary', w.proposal ->> 'summary', 'error', w.error) order by w.created_at)
                            from (select * from work_items w0 where w0.workspace_id = ws and w0.status in ('waiting_decision', 'failed')
                                  and w0.execution_id is null order by w0.created_at limit 100) w
                            left join leads l on l.id = w.lead_id), '[]'::jsonb),
    -- decisions waiting on a person: waiting work items (test runs excluded) + legacy pending approvals without a work item
    'pending_decisions',
      (select count(*) from work_items w
        where w.workspace_id = ws and w.status = 'waiting_decision'
          and not exists (select 1 from leads l where l.id = w.lead_id and (l.contact_name ~ 'UAT|DBG' or l.company ~ 'UAT|DBG'))
          and coalesce(w.proposal ->> 'summary', '') !~ 'UAT|DBG'
          and coalesce(w.proposal -> 'fields' ->> 'contact_name', '') !~ 'UAT|DBG'
          and coalesce(w.proposal -> 'fields' ->> 'customer', '') !~ 'UAT|DBG')
      + (select count(*) from executions x where x.workspace_id = ws and x.status = 'pending_approval' and x.work_item_id is null)
  );
$$;

-- Raw facts behind the onboarding checklist and the website-lead stats (the app derives the labels and the averages).
create or replace function public.promo_state(ws uuid, founding_from timestamptz, founding_to timestamptz)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with website as (select l.id, l.created_at from leads l where l.workspace_id = ws and l.channel ilike '%website%'),
       approved as (select x.responsibility_id from executions x where x.workspace_id = ws and x.status = 'approved')
  select jsonb_build_object(
    'chatbot', (select jsonb_build_object('id', a.id, 'knowledge', a.knowledge) from agents a
                where a.workspace_id = ws and a.module = 'chatbot' order by a.created_at limit 1),
    'is_founding_member', exists (select 1 from events e where e.workspace_id = ws and e.kind = 'module.purchased'
                                  and e.created_at >= founding_from and e.created_at <= founding_to),
    'website_leads', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at)) from website), '[]'::jsonb),
    -- first response per website lead: earliest approval or assignment event
    'first_events', coalesce((select jsonb_agg(jsonb_build_object('lead_id', e.lead_id, 'at', e.first_at))
                              from (select lead_id, min(created_at) as first_at from events
                                    where workspace_id = ws and kind in ('execution.approved', 'responsibility.assigned')
                                      and lead_id in (select id from website) group by lead_id) e), '[]'::jsonb),
    'has_customer_conversation', exists (select 1 from agent_conversations c where c.workspace_id = ws and c.kind = 'customer'),
    'has_lead_conversation', exists (select 1 from agent_conversations c where c.workspace_id = ws and c.lead_id is not null),
    'approved_count', (select count(*) from approved),
    'has_won', exists (select 1 from events e where e.workspace_id = ws and e.kind = 'outcome.recorded'
                       and e.lead_id in (select id from leads where workspace_id = ws and stage = 'won')),
    'invoice_approved', exists (select 1 from responsibilities r where r.workspace_id = ws
                                and (r.title ilike 'Prepare invoice%' or r.title ilike 'Chuẩn bị hóa đơn%')
                                and r.id in (select responsibility_id from approved))
  );
$$;

revoke all on function public.shell_data(uuid, timestamptz, timestamptz), public.promo_state(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.shell_data(uuid, timestamptz, timestamptz), public.promo_state(uuid, timestamptz, timestamptz) to authenticated;
