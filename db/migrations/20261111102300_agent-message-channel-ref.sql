-- agent-message-channel-ref: forward-only; immutable once on origin/main. Expand only: one new nullable column and its index, nothing existing altered.
-- A customer message keeps the channel's own id of the message it came from (`zalo:<message id>`, `tg:<chat>:<message>`, `meta:<event>`), so
-- the same message heard twice in one conversation - a webhook and the poll that reconciles it, a manual import, a replayed inbound event - is
-- stored once. Rows written before this column, and lines no channel brought in, carry none.
ALTER TABLE public.agent_messages ADD COLUMN channel_ref text;
COMMENT ON COLUMN public.agent_messages.channel_ref IS 'The channel''s own id of the customer message this row stores; NULL for lines no channel brought in and for rows written before it.';
CREATE UNIQUE INDEX agent_messages_channel_ref_key ON public.agent_messages (conversation_id, channel_ref)
    WHERE channel_ref IS NOT NULL;
