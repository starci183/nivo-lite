-- The API proves manager membership and creates the request with its pgmq job in one transaction.
-- Existing select/update grants and policies remain; this migration opens only backend insertion.
grant insert on table public.payment_order_requests to app_be;

create policy "payment_order_requests_app_be_insert" on public.payment_order_requests
    for insert to app_be with check (workspace_id is not null and requested_by is not null);
