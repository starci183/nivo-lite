-- order-note-failed-system: the delivery address and notes of an order get their own column, and an order a system failure cut short
-- gets its own status. Expand only: one new column with a default, one widened check. Table grants and row level security of
-- public.orders already cover both (grants are per table, the policies read workspace_id).

ALTER TABLE public.orders ADD COLUMN note text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.orders.note IS
    'The delivery address and the notes the customer gave with the order; empty when there are none.';

ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
    status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'invoiced'::text, 'paid'::text, 'cancelled'::text, 'failed_system'::text])
);
