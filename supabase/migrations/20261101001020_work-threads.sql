-- v0.3.2 "Văn phòng số": one work thread where people and agents tag each other, and the steps of the chain that thread runs.
-- work_threads: the thread of a workspace, optionally about one lead or one order.
-- thread_messages: what a member or an agent wrote in it; mentions is the list of {kind, id} the author tagged, never parsed from
--   text, and approval is the snapshot of the approval card the message carries (the rule, the tagged set, the outcome).
-- work_chains: every step of the chain (who acted, what kind, which rule, what became of it); the Chuỗi thực thi panel and
--   its summary read only this table.
-- Owner capabilities: be/src/modules/domain/work-threads and be/src/modules/domain/work-chains.

CREATE TABLE public.work_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT work_threads_status_check CHECK ((status = ANY (ARRAY['open'::text, 'waiting'::text, 'done'::text, 'stopped'::text]))),
    CONSTRAINT work_threads_title_check CHECK (((length(title) >= 1) AND (length(title) <= 200)))
);

CREATE INDEX work_threads_workspace_id_updated_at_idx ON public.work_threads USING btree (workspace_id, updated_at DESC);
CREATE INDEX work_threads_lead_id_idx ON public.work_threads USING btree (lead_id) WHERE (lead_id IS NOT NULL);

CREATE TABLE public.thread_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    thread_id uuid NOT NULL REFERENCES public.work_threads(id) ON DELETE CASCADE,
    author_kind text NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    quoted jsonb DEFAULT '[]'::jsonb NOT NULL,
    mentions jsonb DEFAULT '[]'::jsonb NOT NULL,
    approval jsonb,
    approval_request_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT thread_messages_author_kind_check CHECK ((author_kind = ANY (ARRAY['member'::text, 'agent'::text]))),
    CONSTRAINT thread_messages_body_check CHECK (((length(body) >= 1) AND (length(body) <= 4000))),
    CONSTRAINT thread_messages_quoted_check CHECK ((jsonb_typeof(quoted) = 'array'::text)),
    CONSTRAINT thread_messages_mentions_check CHECK ((jsonb_typeof(mentions) = 'array'::text)),
    CONSTRAINT thread_messages_approval_check CHECK (((approval IS NULL) = (approval_request_id IS NULL)))
);

CREATE INDEX thread_messages_thread_id_created_at_idx ON public.thread_messages USING btree (thread_id, created_at);
CREATE UNIQUE INDEX thread_messages_approval_request_id_key ON public.thread_messages USING btree (approval_request_id) WHERE (approval_request_id IS NOT NULL);

CREATE TABLE public.work_chains (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    thread_id uuid NOT NULL REFERENCES public.work_threads(id) ON DELETE CASCADE,
    seq integer NOT NULL,
    actor_kind text NOT NULL,
    actor_id uuid NOT NULL,
    kind text NOT NULL,
    action text NOT NULL,
    detail text DEFAULT ''::text NOT NULL,
    rule text,
    target jsonb,
    approval_request_id uuid,
    status text DEFAULT 'done'::text NOT NULL,
    decided_by uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT work_chains_thread_seq_key UNIQUE (thread_id, seq),
    CONSTRAINT work_chains_actor_kind_check CHECK ((actor_kind = ANY (ARRAY['member'::text, 'agent'::text]))),
    CONSTRAINT work_chains_kind_check CHECK ((kind = ANY (ARRAY['self'::text, 'ask_approval'::text, 'hand_off'::text, 'assign'::text]))),
    CONSTRAINT work_chains_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'done'::text, 'rejected'::text, 'expired'::text, 'stopped'::text]))),
    CONSTRAINT work_chains_seq_check CHECK ((seq >= 1)),
    CONSTRAINT work_chains_target_check CHECK (((target IS NULL) OR (jsonb_typeof(target) = 'object'::text)))
);

CREATE INDEX work_chains_approval_request_id_idx ON public.work_chains USING btree (approval_request_id) WHERE (approval_request_id IS NOT NULL);

ALTER TABLE public.work_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_chains ENABLE ROW LEVEL SECURITY;

CREATE POLICY work_threads_app_be_all ON public.work_threads TO app_be
    USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY thread_messages_app_be_all ON public.thread_messages TO app_be
    USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY work_chains_app_be_all ON public.work_chains TO app_be
    USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

REVOKE ALL ON TABLE public.work_threads FROM anon, authenticated;
REVOKE ALL ON TABLE public.thread_messages FROM anon, authenticated;
REVOKE ALL ON TABLE public.work_chains FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.work_threads TO app_be;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.thread_messages TO app_be;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.work_chains TO app_be;
