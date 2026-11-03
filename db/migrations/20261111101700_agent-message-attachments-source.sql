-- Where an attachment a channel brought in came from, so the same file is stored once: `source_url` is the address the channel gave (or the local
-- path of a manual import) and `source_ref` is the channel's own id of the message. A file a person uploads in the web chat has neither.
ALTER TABLE public.agent_message_attachments ADD COLUMN source_url text;
ALTER TABLE public.agent_message_attachments ADD COLUMN source_ref text;
CREATE UNIQUE INDEX agent_message_attachments_source_key ON public.agent_message_attachments (workspace_id, source_ref, source_url) WHERE source_url IS NOT NULL;
