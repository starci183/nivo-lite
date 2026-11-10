-- entity-engine partitions: written in the form of `cli entities plan --write`; forward-only; immutable once on origin/main.
-- Reviewed like a hand-written migration. No transaction control.
-- sales.order gains two real fields the consult collects before the order: the recipient's phone and the delivery time (in the
-- customer's words). They were carried in the free-form note until now.

-- add_check public.records_sales_order:constraint:records_sales_order_recipient_phone_chk: added NOT VALID, then validated
ALTER TABLE public."records_sales_order" ADD CONSTRAINT "records_sales_order_recipient_phone_chk" CHECK ((data->>'recipientPhone') IS NULL OR (jsonb_typeof(data->'recipientPhone') = 'string' AND char_length((data->>'recipientPhone')) <= 500)) NOT VALID;
ALTER TABLE public."records_sales_order" VALIDATE CONSTRAINT "records_sales_order_recipient_phone_chk";
-- add_check public.records_sales_order:constraint:records_sales_order_delivery_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_sales_order" ADD CONSTRAINT "records_sales_order_delivery_at_chk" CHECK ((data->>'deliveryAt') IS NULL OR (jsonb_typeof(data->'deliveryAt') = 'string' AND char_length((data->>'deliveryAt')) <= 500)) NOT VALID;
ALTER TABLE public."records_sales_order" VALIDATE CONSTRAINT "records_sales_order_delivery_at_chk";
