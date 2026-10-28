-- v0.3.2 step 3: one request for approval of one chain step, with the verdicts members gave it.
-- `approvers` and `excluded` are the snapshot taken when the request opened (the approvers in the order a sequential policy asks
-- them); the verdict is always re-checked against the live group and grants. The request is the single row every verdict locks:
-- under the "any" policy the first member to lock it wins. `verdicts` lists what each member answered, appended under that lock after
-- reading it, so a member answers at most once. `chain_step_id` names a step of the execution chain; it carries no foreign key
-- because the chain steps belong to another module. A step has at most one pending request.

CREATE TABLE public.approval_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    chain_step_id uuid NOT NULL,
    department text NOT NULL,
    action text NOT NULL,
    amount numeric,
    unit text DEFAULT 'vnd'::text NOT NULL,
    requested_by_agent_id uuid,
    policy text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    approvers jsonb DEFAULT '[]'::jsonb NOT NULL,
    excluded jsonb DEFAULT '[]'::jsonb NOT NULL,
    verdicts jsonb DEFAULT '[]'::jsonb NOT NULL,
    timeout_minutes integer NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    reminded_at timestamp with time zone,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    escalated_to uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_requests_pkey PRIMARY KEY (id),
    CONSTRAINT approval_requests_unit_check CHECK ((unit = ANY (ARRAY['vnd'::text, 'percent'::text, 'count'::text]))),
    CONSTRAINT approval_requests_policy_check CHECK ((policy = ANY (ARRAY['any'::text, 'all'::text, 'sequential'::text]))),
    CONSTRAINT approval_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text]))),
    CONSTRAINT approval_requests_verdicts_check CHECK ((jsonb_typeof(verdicts) = 'array'::text)),
    CONSTRAINT approval_requests_timeout_check CHECK (((timeout_minutes >= 1) AND (timeout_minutes <= 10080))),
    CONSTRAINT approval_requests_resolved_check CHECK (((status = 'pending'::text) = (resolved_at IS NULL))),
    CONSTRAINT approval_requests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
    CONSTRAINT approval_requests_agent_fkey FOREIGN KEY (requested_by_agent_id) REFERENCES public.agents(id) ON DELETE SET NULL,
    CONSTRAINT approval_requests_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    CONSTRAINT approval_requests_escalated_to_fkey FOREIGN KEY (escalated_to) REFERENCES public.workspace_members(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX approval_requests_pending_step_key ON public.approval_requests USING btree (chain_step_id) WHERE (status = 'pending'::text);
CREATE INDEX approval_requests_due_idx ON public.approval_requests USING btree (expires_at) WHERE (status = 'pending'::text);
CREATE INDEX approval_requests_workspace_idx ON public.approval_requests USING btree (workspace_id, created_at DESC);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY approval_requests_app_be_select ON public.approval_requests FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));
CREATE POLICY approval_requests_app_be_insert ON public.approval_requests FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY approval_requests_app_be_update ON public.approval_requests FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

REVOKE ALL ON TABLE public.approval_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.approval_requests TO app_be;
