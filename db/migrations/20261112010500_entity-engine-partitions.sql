-- entity-engine partitions: written in the form of `cli entities plan --write`; forward-only; immutable once on origin/main.
-- Reviewed like a hand-written migration. No transaction control.
-- sales.order gains the recipient's name and the delivery address as real fields (the address was kept in the free-form note until now;
-- an older order keeps it there and the readers fall back to it).

-- add_check public.records_sales_order:constraint:records_sales_order_recipient_name_chk: added NOT VALID, then validated
ALTER TABLE public."records_sales_order" ADD CONSTRAINT "records_sales_order_recipient_name_chk" CHECK ((data->>'recipientName') IS NULL OR (jsonb_typeof(data->'recipientName') = 'string' AND char_length((data->>'recipientName')) <= 500)) NOT VALID;
ALTER TABLE public."records_sales_order" VALIDATE CONSTRAINT "records_sales_order_recipient_name_chk";
-- add_check public.records_sales_order:constraint:records_sales_order_delivery_address_chk: added NOT VALID, then validated
ALTER TABLE public."records_sales_order" ADD CONSTRAINT "records_sales_order_delivery_address_chk" CHECK ((data->>'deliveryAddress') IS NULL OR (jsonb_typeof(data->'deliveryAddress') = 'string' AND char_length((data->>'deliveryAddress')) <= 500)) NOT VALID;
ALTER TABLE public."records_sales_order" VALIDATE CONSTRAINT "records_sales_order_delivery_address_chk";
