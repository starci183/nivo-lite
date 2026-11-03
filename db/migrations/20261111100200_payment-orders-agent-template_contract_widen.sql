-- payment-orders: an order can now buy an agent template (kind 'agent_template'). Widening only: the old kinds stay allowed and no row changes.
-- The settlement function marks such an order paid like the others; the license and the ledger entries of the creator are written by the
-- back end in the same transaction, from the paid order.

ALTER TABLE public.payment_orders DROP CONSTRAINT payment_orders_kind_check;
ALTER TABLE public.payment_orders
    ADD CONSTRAINT payment_orders_kind_check CHECK (kind IN ('plan', 'upgrade', 'topup', 'credit_pack', 'agent_template'));
