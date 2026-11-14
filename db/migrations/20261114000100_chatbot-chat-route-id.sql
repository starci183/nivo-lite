-- chatbot-chat-route-id: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the DECOUPLE lane: RESTART-R applies it.
-- Expand only. The chat record `blocks-core.chatbot.chat` gains the nullable field `routeId` (uuid): the engine's route
-- (`customer_routes`) the chat belongs to, the one id the engine speaks (P3-ROUTE-API.md section 1). A record is JSONB in `public.records`,
-- so no column is added; the two statements are exactly the ones the entity planner renders into db/entities.ddl.sql for this field:
-- the shape check (absent or null, else a uuid) and the unique index "a route has one chat per agent" (partial: a chat with no route is
-- any number). Chats stored before this change keep routeId null; the front desk's `hear` step writes it when it finds the chat by the
-- person's channel key. No transaction control.
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_route_id_chk" CHECK ((data->>'routeId') IS NULL OR ((data->>'routeId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_route_id_chk";
CREATE UNIQUE INDEX "records_blocks_core_chatbot_chat_route_key" ON public."records_blocks_core_chatbot_chat" USING btree (workspace_id, agent_id, ((data->>'routeId')::uuid)) WHERE ((data->>'routeId')::uuid) IS NOT NULL;
