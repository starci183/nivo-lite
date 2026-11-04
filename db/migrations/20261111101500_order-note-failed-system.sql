-- order-note-failed-system: the delivery address and notes of an order get their own column. Expand only: one new column with a default.
-- The `failed_system` status of an order a system failure cut short is widened in its own contract migration, 20261111102510. Table
-- grants and row level security of public.orders already cover the column (grants are per table, the policies read workspace_id).

ALTER TABLE public.orders ADD COLUMN note text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.orders.note IS
    'The delivery address and the notes the customer gave with the order; empty when there are none.';
