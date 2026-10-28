-- NIVO records only real input (owner ruling, 2026-10-21: production is cleaned at the v0.3.0 deploy). The rows of the retired
-- simulator and simulated bank door are deleted, children before parents (every foreign key below cascades or sets null), and
-- the origin columns and their checks are dropped. The functions that read or wrote origin are replaced first, so none of them
-- names a dropped column. The retired simulated bank door leaves nothing behind either: its pending jobs, its receipt
-- table (with its policies and grants) and its pgmq queue are removed.

CREATE OR REPLACE FUNCTION public.booking_reserve(p jsonb, p_force boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_res uuid := (p ->> 'resource_id')::uuid;
  v_cap int;
  v_party int := coalesce((p ->> 'party_size')::int, 1);
  v_id uuid;
  v_holds boolean := coalesce((p ->> 'holds_slot')::boolean, true);
begin
  perform pg_advisory_xact_lock(hashtextextended(v_res::text, 0));
  select capacity into v_cap from public.booking_resources where id = v_res and workspace_id = (p ->> 'workspace_id')::uuid;
  if v_cap is null then raise exception 'resource not found'; end if;
  if v_holds and not p_force
     and public.booking_peak_load(v_res, (p ->> 'start_at')::timestamptz, (p ->> 'block_end_at')::timestamptz, null) + v_party > v_cap then
    return null;
  end if;
  insert into public.bookings (workspace_id, lead_id, conversation_id, customer_name, customer_phone, customer_email, service_id, resource_id, start_at, end_at, block_end_at,
                               party_size, status, holds_slot, source_channel, price_vnd, deposit_vnd, deposit_status, note, conflict_note, idempotency_key)
  values ((p ->> 'workspace_id')::uuid, nullif(p ->> 'lead_id', '')::uuid, nullif(p ->> 'conversation_id', '')::uuid, coalesce(p ->> 'customer_name', ''), nullif(p ->> 'customer_phone', ''),
          nullif(p ->> 'customer_email', ''), (p ->> 'service_id')::uuid, v_res, (p ->> 'start_at')::timestamptz, (p ->> 'end_at')::timestamptz, (p ->> 'block_end_at')::timestamptz,
          v_party, coalesce(p ->> 'status', 'requested'), v_holds, coalesce(p ->> 'source_channel', 'manual'), nullif(p ->> 'price_vnd', '')::bigint,
          coalesce((p ->> 'deposit_vnd')::bigint, 0), coalesce(p ->> 'deposit_status', 'none'), coalesce(p ->> 'note', ''), coalesce(p ->> 'conflict_note', ''),
          nullif(p ->> 'idempotency_key', ''))
  returning id into v_id;
  return v_id;
end $$;

REVOKE EXECUTE ON FUNCTION public.booking_reserve(p jsonb, p_force boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.governance_rows(ws uuid, since7 timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'auth', (select jsonb_build_object('goal_revenue_vnd', a.goal_revenue_vnd, 'goal_new_customers', a.goal_new_customers,
                                       'goal_first_reply_minutes', a.goal_first_reply_minutes)
             from authority a where a.workspace_id = ws),
    'leads', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'contact_name', l.contact_name, 'company', l.company,
                                                           'stage', l.stage, 'created_at', l.created_at))
                       from (select * from leads where workspace_id = ws limit 10000) l), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'lead_id', o.lead_id, 'order_no', o.order_no, 'items', o.items,
                                                            'amount_vnd', o.amount_vnd, 'status', o.status))
                        from orders o where o.workspace_id = ws and o.status in ('confirmed', 'invoiced', 'paid')), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'order_id', i.order_id, 'lead_id', i.lead_id, 'invoice_no', i.invoice_no,
                                                              'amount_vnd', i.amount_vnd, 'status', i.status))
                          from invoices i where i.workspace_id = ws and i.status in ('issued', 'paid')), '[]'::jsonb),
    'txs', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'invoice_id', t.invoice_id, 'payer', t.payer, 'reference', t.reference,
                                                         'amount_vnd', t.amount_vnd, 'status', t.status))
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

CREATE OR REPLACE FUNCTION public.record_lead_outcome(p_workspace uuid, p_lead uuid, p_stage text, p_evidence text, p_locale text DEFAULT 'vi'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_actor text := public.lead_actor_name(p_workspace);
  v_en boolean := coalesce(p_locale, 'vi') = 'en';
  v_lead record;
  v_label text;
  v_agent record;
  v_handed boolean := false;
begin
  if p_stage not in ('new', 'qualified', 'proposal', 'won', 'lost') then
    raise exception 'stage_invalid' using errcode = '22023';
  end if;
  update public.leads set stage = p_stage where workspace_id = p_workspace and id = p_lead
  returning id, contact_name, company, channel, need, stage into v_lead;
  if not found then
    raise exception 'LEADS_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_label := case p_stage
    when 'new' then case when v_en then 'new' else 'mới' end
    when 'qualified' then case when v_en then 'qualified' else 'đủ điều kiện' end
    when 'proposal' then case when v_en then 'proposal' else 'đề xuất' end
    when 'won' then case when v_en then 'won' else 'chốt được' end
    else case when v_en then 'lost' else 'không chốt' end
  end;
  insert into public.events (workspace_id, lead_id, kind, actor, summary, evidence)
  values (p_workspace, p_lead, 'outcome.recorded', v_actor,
          case when v_en then 'Stage → ' else 'Giai đoạn → ' end || v_label, nullif(p_evidence, ''));
  insert into public.messages (workspace_id, lead_id, author_kind, author_name, body)
  values (p_workspace, p_lead, 'system', 'NIVO',
          case when v_en then v_lead.contact_name || ' moved to ' || v_label || '.' else v_lead.contact_name || ' chuyển sang ' || v_label || '.' end);
  if p_stage = 'won' then
    select a.id, a.name into v_agent from public.agents a
     where a.workspace_id = p_workspace and a.module = 'accounting' and a.status = 'active'
     order by a.created_at limit 1;
    if found then
      insert into public.responsibilities (workspace_id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action, due_at)
      values (p_workspace, p_lead,
              case when v_en then 'Prepare invoice for ' || v_lead.contact_name else 'Chuẩn bị hóa đơn cho ' || v_lead.contact_name end,
              'agent', v_agent.id, v_agent.name,
              case when v_en then 'Draft the invoice from the agreed scope for owner approval'
                   else 'Soạn hóa đơn theo phạm vi đã thống nhất để chủ doanh nghiệp duyệt' end,
              now() + interval '1 day');
      insert into public.events (workspace_id, lead_id, kind, actor, summary)
      values (p_workspace, p_lead, 'responsibility.assigned', 'Sales Agent',
              case when v_en then 'Handed to ' || v_agent.name || ' · Next action: Draft the invoice from the agreed scope'
                   else 'Đã bàn giao cho ' || v_agent.name || ' · Bước tiếp theo: Soạn hóa đơn theo phạm vi đã thống nhất' end);
      v_handed := true;
    end if;
  end if;
  return jsonb_build_object(
    'leadId', v_lead.id, 'stage', v_lead.stage, 'contactName', v_lead.contact_name, 'company', v_lead.company,
    'channel', v_lead.channel, 'need', v_lead.need, 'handedToAccounting', v_handed
  );
end;
$$;

REVOKE EXECUTE ON FUNCTION public.record_lead_outcome(p_workspace uuid, p_lead uuid, p_stage text, p_evidence text, p_locale text) FROM PUBLIC, anon, authenticated;

DELETE FROM public.transactions WHERE origin <> 'live';
DELETE FROM public.bookings WHERE origin <> 'live';
DELETE FROM public.invoices WHERE origin <> 'live';
DELETE FROM public.orders WHERE origin <> 'live';
DELETE FROM public.work_items WHERE origin <> 'live';
DELETE FROM public.inbound_events WHERE origin <> 'live';
DELETE FROM public.leads WHERE origin <> 'live';

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_origin_check, DROP COLUMN origin;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_origin_check, DROP COLUMN origin;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_origin_check, DROP COLUMN origin;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_origin_check, DROP COLUMN origin;
ALTER TABLE public.work_items DROP CONSTRAINT IF EXISTS work_items_origin_check, DROP COLUMN origin;
ALTER TABLE public.inbound_events DROP CONSTRAINT IF EXISTS inbound_events_origin_check, DROP COLUMN origin;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_origin_check, DROP COLUMN origin;

DELETE FROM public.job_outbox WHERE queue = 'vietcombank-delivery';
DELETE FROM public.job_slots WHERE queue = 'vietcombank-delivery';
DELETE FROM public.jobs WHERE kind = 'vietcombank-delivery';

DROP TABLE IF EXISTS public.vietcombank_inbox;

SELECT pgmq.drop_queue('vietcombank-delivery');
