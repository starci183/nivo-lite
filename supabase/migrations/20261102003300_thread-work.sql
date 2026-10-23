-- v0.3.2: the work an agent does inside a work thread. One row per work item the agents' runtime started for a thread: which
-- agent does it, where it stands in the thread (running, asked a group for approval, waiting for a member's answer, done, stopped),
-- the approval request it waits for and, when it waits for data, the member it asked and the fields it needs. The thread-work
-- capability is its only writer; the work item itself stays in work_items.

CREATE TABLE public.thread_work (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    thread_id uuid NOT NULL,
    work_item_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    state text DEFAULT 'running'::text NOT NULL,
    approval_request_id uuid,
    waiting_member_id uuid,
    missing_fields text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT thread_work_pkey PRIMARY KEY (id),
    CONSTRAINT thread_work_work_item_key UNIQUE (work_item_id),
    CONSTRAINT thread_work_state_check CHECK ((state = ANY (ARRAY['running'::text, 'asked'::text, 'waiting_member'::text, 'done'::text, 'stopped'::text]))),
    CONSTRAINT thread_work_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
    CONSTRAINT thread_work_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.work_threads(id) ON DELETE CASCADE,
    CONSTRAINT thread_work_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE CASCADE,
    CONSTRAINT thread_work_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE,
    CONSTRAINT thread_work_waiting_member_id_fkey FOREIGN KEY (waiting_member_id) REFERENCES public.workspace_members(id) ON DELETE SET NULL
);

CREATE INDEX thread_work_thread_idx ON public.thread_work USING btree (workspace_id, thread_id);
CREATE INDEX thread_work_asked_idx ON public.thread_work USING btree (state) WHERE (state = 'asked'::text);

ALTER TABLE public.thread_work ENABLE ROW LEVEL SECURITY;

CREATE POLICY thread_work_app_be_select ON public.thread_work FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));
CREATE POLICY thread_work_app_be_insert ON public.thread_work FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY thread_work_app_be_update ON public.thread_work FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

REVOKE ALL ON TABLE public.thread_work FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.thread_work TO app_be;
