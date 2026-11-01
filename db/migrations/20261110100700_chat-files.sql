-- chat-files: a file sent with a message, by a customer in a conversation or by a member in the Office (a transfer screenshot, a PDF).
-- Expand only: one new table, nothing existing altered. message_id names a row of agent_messages or, with no conversation, of messages,
-- so it carries no foreign key; a conversation or a workspace takes its rows with it.
-- The bytes sit in the private store under <workspace>/chat/<conversation or office>/, read through short-lived addresses; a row exists only for
-- an object whose bytes were checked when the message was sent, so an upload nobody sent leaves no row.

CREATE TABLE public.agent_message_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    conversation_id uuid REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
    message_id uuid NOT NULL,
    path text NOT NULL,
    name text NOT NULL,
    content_type text NOT NULL,
    size_bytes integer NOT NULL,
    read jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_message_attachments_path_key UNIQUE (path),
    CONSTRAINT agent_message_attachments_type_check CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
    CONSTRAINT agent_message_attachments_size_check CHECK (size_bytes > 0 AND size_bytes <= 10485760)
);
CREATE INDEX agent_message_attachments_message_idx ON public.agent_message_attachments USING btree (workspace_id, message_id);

CREATE TRIGGER agent_message_attachments_set_updated_at BEFORE UPDATE ON public.agent_message_attachments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agent_message_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_message_attachments_app_be_select ON public.agent_message_attachments FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_message_attachments_app_be_insert ON public.agent_message_attachments FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_message_attachments_app_be_update ON public.agent_message_attachments FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.agent_message_attachments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agent_message_attachments TO app_be;
