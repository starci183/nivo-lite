-- Perf: one request per heavy page. Netlify runs ~220 ms from the database, and every PARALLEL query also opens its own connection
-- (TCP + TLS + request = about 3 round trips), so a page that fanned out 13-22 reads took 1-2 s even with perfect parallelism.
-- These functions return the SAME rows the app used to read one by one (same columns, same order, same limits) as one jsonb document;
-- the app shapes them exactly as before. SECURITY INVOKER: everything runs under the caller's RLS (the service role for the automations
-- screen, which already read with it). Nothing here writes.
-- (to_jsonb(row) is what `select *` returns through PostgREST: same keys, same timestamp and number formats.)

-- The leads / orders / invoices / payments / work items / decisions behind the governance figures (getGovernance in src/lib/flow-queries.ts).
create or replace function public.governance_rows(ws uuid, since7 timestamptz)
returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'auth', (select jsonb_build_object('goal_revenue_vnd', a.goal_revenue_vnd, 'goal_new_customers', a.goal_new_customers,
                                       'goal_first_reply_minutes', a.goal_first_reply_minutes)
             from authority a where a.workspace_id = ws),
    'leads', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'contact_name', l.contact_name, 'company', l.company,
                                                           'origin', l.origin, 'stage', l.stage, 'created_at', l.created_at))
                       from (select * from leads where workspace_id = ws limit 10000) l), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'lead_id', o.lead_id, 'order_no', o.order_no, 'items', o.items,
                                                            'amount_vnd', o.amount_vnd, 'status', o.status, 'origin', o.origin))
                        from orders o where o.workspace_id = ws and o.status in ('confirmed', 'invoiced', 'paid')), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'order_id', i.order_id, 'lead_id', i.lead_id, 'invoice_no', i.invoice_no,
                                                              'amount_vnd', i.amount_vnd, 'status', i.status, 'origin', i.origin))
                          from invoices i where i.workspace_id = ws and i.status in ('issued', 'paid')), '[]'::jsonb),
    'txs', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'invoice_id', t.invoice_id, 'payer', t.payer, 'reference', t.reference,
                                                         'amount_vnd', t.amount_vnd, 'status', t.status, 'origin', t.origin))
                     from transactions t where t.workspace_id = ws and t.status in ('matched', 'unmatched', 'needs_review')), '[]'::jsonb),
    'work', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'lead_id', w.lead_id, 'department', w.department, 'status', w.status,
                                                          'reason', w.reason, 'decided_path', w.decided_path, 'created_at', w.created_at,
                                                          'updated_at', w.updated_at, 'completed_at', w.completed_at,
                                                          'summary', w.proposal ->> 'summary',
                                                          'contact', w.proposal -> 'fields' ->> 'contact_name',
                                                          'customer', w.proposal -> 'fields' ->> 'customer') order by w.created_at desc)
                      from (select * from work_items where workspace_id = ws order by created_at desc limit 2000) w), '[]'::jsonb),
    'pending_without_work', (select count(*) from executions x where x.workspace_id = ws and x.status = 'pending_approval' and x.work_item_id is null),
    'decisions7', coalesce((select jsonb_agg(jsonb_build_object('work_item_id', d.work_item_id, 'lead_id', d.lead_id, 'decider_kind', d.decider_kind,
                                                                'outcome', d.outcome, 'created_at', d.created_at))
                            from decisions d where d.workspace_id = ws and d.created_at >= since7), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(to_jsonb(d) || jsonb_build_object('lead', (select jsonb_build_object('contact_name', l.contact_name)
                                                                                 from leads l where l.id = d.lead_id)) order by d.created_at desc)
                        from (select * from decisions where workspace_id = ws order by created_at desc limit 40) d), '[]'::jsonb)
  );
$$;

-- Work items waiting for a decision or failed, with their lead and assigned staff (listExceptions).
create or replace function public.exception_rows(ws uuid)
returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(w) || jsonb_build_object(
           'lead', (select jsonb_build_object('id', l.id, 'contact_name', l.contact_name, 'company', l.company, 'channel', l.channel) from leads l where l.id = w.lead_id),
           'staff', (select jsonb_build_object('name', s.name) from staff s where s.id = w.assigned_staff_id)) order by w.created_at), '[]'::jsonb)
  from (select * from work_items where workspace_id = ws and status in ('waiting_decision', 'failed') order by created_at limit 100) w;
$$;

-- Responsibilities with their lead (listResponsibilities), due first.
create or replace function public.responsibility_rows(ws uuid)
returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object(
           'lead', (select jsonb_build_object('id', l.id, 'contact_name', l.contact_name, 'company', l.company, 'stage', l.stage) from leads l where l.id = r.lead_id))
         order by r.due_at asc nulls last), '[]'::jsonb)
  from responsibilities r where r.workspace_id = ws;
$$;

-- /dashboard: everything the executive view reads.
create or replace function public.dashboard_data(ws uuid, since7 timestamptz, founding_from timestamptz, founding_to timestamptz)
returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'responsibilities', public.responsibility_rows(ws),
    'agents', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from agents a where a.workspace_id = ws), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc)
                        from (select * from events where workspace_id = ws order by created_at desc limit 6) e), '[]'::jsonb),
    'leads', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'stage', l.stage, 'created_at', l.created_at, 'contact_name', l.contact_name, 'company', l.company))
                       from leads l where l.workspace_id = ws), '[]'::jsonb),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'responsibility_id', x.responsibility_id, 'created_at', x.created_at,
                                                             'lead_id', (select r.lead_id from responsibilities r where r.id = x.responsibility_id)) order by x.created_at desc)
                         from executions x where x.workspace_id = ws and x.status = 'pending_approval'), '[]'::jsonb),
    'promo', public.promo_state(ws, founding_from, founding_to),
    'governance', public.governance_rows(ws, since7),
    'exceptions', public.exception_rows(ws)
  );
$$;

-- /chat (Office): the messenger's whole first paint.
create or replace function public.office_data(ws uuid, since7 timestamptz)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with exec_json as (
    select x.status as st, x.created_at as c_at, x.decided_at as d_at,
           to_jsonb(x) || jsonb_build_object(
             'responsibility', (select to_jsonb(r) || jsonb_build_object('lead', (select jsonb_build_object('id', l.id, 'contact_name', l.contact_name, 'company', l.company, 'channel', l.channel)
                                                                                 from leads l where l.id = r.lead_id))
                                from responsibilities r where r.id = x.responsibility_id),
             'work_item', (select jsonb_build_object('id', w.id, 'assigned_staff_id', w.assigned_staff_id) from work_items w where w.id = x.work_item_id),
             'agent', (select jsonb_build_object('id', a.id, 'name', a.name) from agents a where a.id = x.agent_id)) as j
    from executions x where x.workspace_id = ws and x.status in ('pending_approval', 'approved', 'rejected')
  )
  select jsonb_build_object(
    'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc)
                          from (select * from messages where workspace_id = ws order by created_at desc limit 100) m), '[]'::jsonb),
    'agents', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from agents a where a.workspace_id = ws), '[]'::jsonb),
    'responsibilities', public.responsibility_rows(ws),
    'pending', coalesce((select jsonb_agg(j order by c_at desc) from exec_json where st = 'pending_approval'), '[]'::jsonb),
    'decided', coalesce((select jsonb_agg(z.j order by z.d_at desc nulls last)
                         from (select j, d_at from exec_json where st in ('approved', 'rejected') order by d_at desc nulls last limit 8) z), '[]'::jsonb),
    'leads', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from leads l where l.workspace_id = ws), '[]'::jsonb),
    'open_responsibilities', coalesce((select jsonb_agg(jsonb_build_object('lead_id', r.lead_id, 'owner_name', r.owner_name, 'next_action', r.next_action, 'status', r.status))
                                       from responsibilities r where r.workspace_id = ws and r.status <> 'done'), '[]'::jsonb),
    'exceptions', public.exception_rows(ws),
    'recent_items', coalesce((select jsonb_agg(to_jsonb(w) || jsonb_build_object(
                                'lead', (select jsonb_build_object('id', l.id, 'contact_name', l.contact_name, 'company', l.company, 'channel', l.channel) from leads l where l.id = w.lead_id),
                                'staff', (select jsonb_build_object('name', s.name) from staff s where s.id = w.assigned_staff_id),
                                'decisions', coalesce((select jsonb_agg(jsonb_build_object('decided_by', d.decided_by, 'created_at', d.created_at)) from decisions d where d.work_item_id = w.id), '[]'::jsonb))
                              order by w.created_at desc)
                              from (select * from work_items where workspace_id = ws and status in ('done', 'rejected') order by created_at desc limit 40) w), '[]'::jsonb),
    'governance', public.governance_rows(ws, since7),
    'staff', coalesce((select jsonb_agg(to_jsonb(s) order by s.active desc, s.created_at) from staff s where s.workspace_id = ws), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(to_jsonb(m)) from public.workspace_members_directory(ws) m), '[]'::jsonb)
  );
$$;

revoke all on function public.governance_rows(uuid, timestamptz), public.exception_rows(uuid), public.responsibility_rows(uuid),
  public.dashboard_data(uuid, timestamptz, timestamptz, timestamptz), public.office_data(uuid, timestamptz) from public, anon;
grant execute on function public.governance_rows(uuid, timestamptz), public.exception_rows(uuid), public.responsibility_rows(uuid),
  public.dashboard_data(uuid, timestamptz, timestamptz, timestamptz), public.office_data(uuid, timestamptz) to authenticated;
