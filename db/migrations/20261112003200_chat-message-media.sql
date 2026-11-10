-- chat-message-media: forward-only; immutable once on origin/main.
-- A stored chat line keeps what the customer received: `files` holds the pictures of the line ({ items: [{ id, url, name, contentType }] }, the showcase album and the payment QR)
-- and `orderCard` holds the order the line is about (a snapshot with the photo of each item), so the inbox shows them. Both are nullable; a line from before has neither. No backfill.
-- Rendered like the entity-engine planner's add_check for a nullable jsonb field.

-- add_check public.records_chat_message:constraint:records_chat_message_files_chk: added NOT VALID, then validated
ALTER TABLE public."records_chat_message" ADD CONSTRAINT "records_chat_message_files_chk" CHECK ((data->>'files') IS NULL OR (jsonb_typeof(data->'files') = 'object')) NOT VALID;
ALTER TABLE public."records_chat_message" VALIDATE CONSTRAINT "records_chat_message_files_chk";
-- add_check public.records_chat_message:constraint:records_chat_message_order_card_chk: added NOT VALID, then validated
ALTER TABLE public."records_chat_message" ADD CONSTRAINT "records_chat_message_order_card_chk" CHECK ((data->>'orderCard') IS NULL OR (jsonb_typeof(data->'orderCard') = 'object')) NOT VALID;
ALTER TABLE public."records_chat_message" VALIDATE CONSTRAINT "records_chat_message_order_card_chk";
