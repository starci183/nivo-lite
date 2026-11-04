-- order-status-failed-system: an order a system failure cut short gets its own status, `failed_system`. Widening only: the old statuses
-- stay allowed and no row changes. Table grants and row level security of public.orders already cover it.

ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
    status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'invoiced'::text, 'paid'::text, 'cancelled'::text, 'failed_system'::text])
);
