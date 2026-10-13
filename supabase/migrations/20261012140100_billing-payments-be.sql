-- The lite back end (role app_be) takes over the payment webhooks. The tables it reads and writes are already granted by
-- 20261012130100_app-be-grants.sql; this migration adds what is specific to billing:
--   * the pgmq queue of bank credits: a credit that reaches a workspace becomes an inbound payment event and one job on this
--     queue, both in the transaction of the webhook, so the job exists exactly when the event does;
--   * execute on settle_payment_order, the atomic settlement of a payment order (security definer, it was callable by the
--     service role only);
--   * connection_mark_fed, the one statement that remembers a connection received its first credit. The connections table belongs
--     to the connections capability, so billing reaches it through this function (invoker rights: the row policies of app_be apply).
create extension if not exists pgmq;

select pgmq.create('bank_credit_received');

grant select, insert, update, delete on table pgmq.q_bank_credit_received to app_be;
grant select, insert on table pgmq.a_bank_credit_received to app_be;

grant execute on function public.settle_payment_order(text, bigint, bigint) to app_be;

create or replace function public.connection_mark_fed(p_connection uuid, p_at timestamptz, p_first_event jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
    update public.connections
    set last_event_at = p_at,
        last_error = null,
        updated_at = p_at,
        status = case when status in ('pending', 'error') then 'connected' else status end,
        first_event = coalesce(first_event, p_first_event)
    where id = p_connection;
$$;

revoke all on function public.connection_mark_fed(uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.connection_mark_fed(uuid, timestamptz, jsonb) to app_be;
