-- Billing and AI usage on the lite architecture: the web app never calls the back end, so everything that only the back end may do
-- (a payment order carries a price and a code, so customers never write it) is a request row the member creates through one
-- security definer function; the back end consumes it from a pgmq queue and writes the answer back to the same row.
--   * payment_order_requests: one row per "pay / renew / buy a pack / upgrade" click; the manager reads it under RLS, the job answers it.
--   * payment_order_request(): the only way to create one (owner or manager of the workspace); it commits the row and its job together.
--   * usage_quota_status(): a member's read of this month's allowance (ai_quota_status itself is service role only).
--   * usage_notice_post(): the one statement that tells a workspace owner "80% used" or "limit reached" once per month and level.
create extension if not exists pgmq;

select pgmq.create('payment_order_requested');
grant select, insert, update, delete on table pgmq.q_payment_order_requested to app_be;
grant select, insert on table pgmq.a_payment_order_requested to app_be;

create table public.payment_order_requests (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    requested_by uuid not null,
    kind text not null check (kind in ('plan', 'renew', 'topup', 'upgrade')),
    target text check (target is null or target ~ '^[a-z0-9_-]{1,40}$'),
    status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
    order_id uuid references public.payment_orders (id) on delete set null,
    fault text,
    created_at timestamptz not null default now(),
    answered_at timestamptz
);
create index payment_order_requests_ws_time on public.payment_order_requests (workspace_id, created_at desc);

alter table public.payment_order_requests enable row level security;
revoke all on table public.payment_order_requests from anon, authenticated;
grant select on table public.payment_order_requests to authenticated;
grant select, update on table public.payment_order_requests to app_be;

create policy "payment_order_requests_manager_select" on public.payment_order_requests
    for select to authenticated using (public.is_manager(workspace_id) and requested_by = auth.uid());
create policy "payment_order_requests_app_be_select" on public.payment_order_requests
    for select to app_be using (workspace_id is not null);
create policy "payment_order_requests_app_be_update" on public.payment_order_requests
    for update to app_be using (workspace_id is not null) with check (workspace_id is not null);

create or replace function public.payment_order_request(p_workspace uuid, p_kind text, p_target text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    if auth.uid() is null or not public.is_manager(p_workspace) then
        raise exception 'not allowed' using errcode = '42501';
    end if;
    if p_kind not in ('plan', 'renew', 'topup', 'upgrade') then
        raise exception 'unknown kind %', p_kind using errcode = '22023';
    end if;
    if p_kind <> 'renew' and (p_target is null or p_target !~ '^[a-z0-9_-]{1,40}$') then
        raise exception 'a target is required' using errcode = '22023';
    end if;
    insert into public.payment_order_requests (workspace_id, requested_by, kind, target)
    values (p_workspace, auth.uid(), p_kind, case when p_kind = 'renew' then null else p_target end)
    returning id into v_id;
    perform public.job_enqueue(
        p_workspace,
        'payment_order_requested',
        'payment_order_requested',
        jsonb_build_object('workspaceId', p_workspace, 'requestId', v_id),
        'payment-order-request:' || v_id::text
    );
    return v_id;
end;
$$;

revoke all on function public.payment_order_request(uuid, text, text) from public, anon;
grant execute on function public.payment_order_request(uuid, text, text) to authenticated;

create or replace function public.usage_quota_status(p_workspace uuid)
returns table (
    period_start date, messages_used bigint, tokens_used bigint, cost_usd numeric,
    messages_limit int, tokens_limit bigint, fallback_reply text,
    credits_used numeric, credits_limit bigint, credits_carried numeric, topup_balance bigint
)
language sql
stable
security definer
set search_path = public
as $$
    select q.* from public.ai_quota_status(p_workspace) q where public.is_member(p_workspace);
$$;

revoke all on function public.usage_quota_status(uuid) from public, anon;
grant execute on function public.usage_quota_status(uuid) to authenticated;


create or replace function public.usage_notice_post(p_workspace uuid, p_period date, p_level text, p_body text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
    insert into public.ai_usage_notices (workspace_id, period, level)
    values (p_workspace, p_period, p_level)
    on conflict (workspace_id, period, level) do nothing;
    if not found then
        return false;
    end if;
    insert into public.messages (workspace_id, author_kind, author_name, body)
    values (p_workspace, 'system', 'NIVO', p_body);
    return true;
end;
$$;

revoke all on function public.usage_notice_post(uuid, date, text, text) from public, anon, authenticated;
grant execute on function public.usage_notice_post(uuid, date, text, text) to app_be;
