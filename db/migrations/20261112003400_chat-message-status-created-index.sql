-- chat-message-status-created-index: forward-only; immutable once on origin/main.
-- A node read of a conversation's posted lines (chatbot.thread) pins conversationId and status and reads newest first by createdAt,
-- which no declared index served: QUERY_NOT_INDEXED parked every front-desk run.

-- create_index public.records_chat_message:index:records_chat_message_conversation_status_created: on workspace_id, data->>'conversationid', data->>'status', created_atdesc, iddesc using btree
CREATE INDEX "records_chat_message_conversation_status_created" ON public."records_chat_message" USING btree (workspace_id, ((data->>'conversationId')::uuid), (data->>'status'), created_at DESC, id DESC);
