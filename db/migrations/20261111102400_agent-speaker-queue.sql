-- agent-speaker-queue: forward-only; immutable once on origin/main. Expand only: one new table, nothing existing altered.
-- One agent speaks to the customer of a conversation at a time: the holder (agent_conversations.agent_id). A hand-off passes the right
-- to speak to the agent it tags; a second hand-off while another agent holds the conversation waits here, in order, and is written as
-- that agent's wake only when the holder hands the conversation on. When the holder's work is done and nobody waits, the conversation
-- returns to the agent that opened the door.
CREATE TABLE public.agent_speaker_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
    to_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    event_key text NOT NULL,
    request jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_speaker_queue_event_key UNIQUE (conversation_id, event_key)
);
CREATE INDEX agent_speaker_queue_conversation_idx ON public.agent_speaker_queue USING btree (conversation_id, created_at, id);
CREATE TRIGGER agent_speaker_queue_set_updated_at BEFORE UPDATE ON public.agent_speaker_queue FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.agent_speaker_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_speaker_queue_app_be_select ON public.agent_speaker_queue FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_speaker_queue_app_be_insert ON public.agent_speaker_queue FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_speaker_queue_app_be_delete ON public.agent_speaker_queue FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
GRANT SELECT, INSERT, DELETE ON TABLE public.agent_speaker_queue TO app_be;
