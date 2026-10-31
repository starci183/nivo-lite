-- agent-graphs: forward-only; immutable once on origin/main. Expand only: new tables, nothing existing altered.
-- Each agent is a flow the owner can read and change. The draft lives on agent_graphs and takes a draft_rev check so two managers
-- cannot overwrite each other; publishing freezes a row of agent_graph_versions, which app_be may only SELECT and INSERT, so the
-- database itself refuses a change to a version. A decision keeps the version that decided, the path, the facts as read and the
-- branch. turn_id and wake_id carry no foreign key: turns go at 30 days and a decision stays as the audit.

CREATE TABLE public.agent_graphs (
    agent_id uuid NOT NULL PRIMARY KEY REFERENCES public.agents(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    installation_id uuid NOT NULL UNIQUE REFERENCES public.module_installations(id) ON DELETE CASCADE,
    draft jsonb NOT NULL,
    draft_rev integer NOT NULL DEFAULT 1,
    active_version_id uuid,
    mode text NOT NULL DEFAULT 'shadow',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_graphs_mode_check CHECK (mode IN ('shadow', 'enforced')),
    CONSTRAINT agent_graphs_draft_check CHECK (jsonb_typeof(draft) = 'object')
);
CREATE INDEX agent_graphs_workspace_idx ON public.agent_graphs USING btree (workspace_id);

CREATE TABLE public.agent_graph_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    version integer NOT NULL,
    document jsonb NOT NULL,
    document_hash text NOT NULL,
    context_version_id uuid,
    change_kind text NOT NULL,
    note text NOT NULL DEFAULT '',
    published_by uuid REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    published_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_graph_versions_version_key UNIQUE (agent_id, version),
    CONSTRAINT agent_graph_versions_kind_check CHECK (change_kind IN ('seed', 'chat', 'edit', 'conflict', 'learned', 'template', 'rollback')),
    CONSTRAINT agent_graph_versions_document_check CHECK (jsonb_typeof(document) = 'object')
);

CREATE TABLE public.agent_graph_sources (
    version_id uuid NOT NULL REFERENCES public.agent_graph_versions(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    node_key text NOT NULL,
    branch_key text NOT NULL DEFAULT '',
    kind text NOT NULL,
    ref text NOT NULL,
    value_hash text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_graph_sources_pkey PRIMARY KEY (version_id, node_key, branch_key, kind, ref)
);
CREATE INDEX agent_graph_sources_brain_idx ON public.agent_graph_sources USING btree (agent_id, ref) WHERE kind = 'brain';

CREATE TABLE public.agent_graph_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    dedupe_key text NOT NULL,
    kind text NOT NULL,
    status text NOT NULL DEFAULT 'open',
    base_version_id uuid REFERENCES public.agent_graph_versions(id) ON DELETE SET NULL,
    node_key text,
    branch_key text,
    patch jsonb NOT NULL DEFAULT '{}'::jsonb,
    widens boolean NOT NULL DEFAULT false,
    evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
    decided_by uuid REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    decided_at timestamptz,
    result_version_id uuid REFERENCES public.agent_graph_versions(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_graph_proposals_dedupe_key UNIQUE (agent_id, dedupe_key),
    CONSTRAINT agent_graph_proposals_kind_check CHECK (kind IN ('conflict', 'learned', 'template_update')),
    CONSTRAINT agent_graph_proposals_status_check CHECK (status IN ('open', 'confirmed', 'declined', 'superseded'))
);
CREATE INDEX agent_graph_proposals_open_idx ON public.agent_graph_proposals USING btree (agent_id, created_at DESC) WHERE status = 'open';

CREATE TABLE public.agent_graph_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
    version_id uuid NOT NULL REFERENCES public.agent_graph_versions(id),
    turn_id uuid,
    wake_id uuid,
    action text NOT NULL,
    path jsonb NOT NULL DEFAULT '[]'::jsonb,
    facts jsonb NOT NULL DEFAULT '{}'::jsonb,
    branch_key text NOT NULL,
    outcome text NOT NULL,
    approval_request_id uuid,
    closed_as text,
    shadow_diff boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_graph_decisions_work_item_key UNIQUE (work_item_id),
    CONSTRAINT agent_graph_decisions_outcome_check CHECK (outcome IN ('auto', 'ask', 'stop')),
    CONSTRAINT agent_graph_decisions_closed_check CHECK (closed_as IS NULL OR closed_as IN ('done', 'approved', 'edited', 'rejected', 'expired'))
);
CREATE INDEX agent_graph_decisions_branch_idx ON public.agent_graph_decisions USING btree (agent_id, branch_key, created_at) WHERE closed_as IS NOT NULL;

ALTER TABLE public.agent_graphs ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_graphs_app_be_select ON public.agent_graphs FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_graphs_app_be_insert ON public.agent_graphs FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_graphs_app_be_update ON public.agent_graphs FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
GRANT SELECT, INSERT, UPDATE ON TABLE public.agent_graphs TO app_be;

ALTER TABLE public.agent_graph_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_graph_versions_app_be_select ON public.agent_graph_versions FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_graph_versions_app_be_insert ON public.agent_graph_versions FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
GRANT SELECT, INSERT ON TABLE public.agent_graph_versions TO app_be;

ALTER TABLE public.agent_graph_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_graph_sources_app_be_select ON public.agent_graph_sources FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_graph_sources_app_be_insert ON public.agent_graph_sources FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
GRANT SELECT, INSERT ON TABLE public.agent_graph_sources TO app_be;

ALTER TABLE public.agent_graph_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_graph_proposals_app_be_select ON public.agent_graph_proposals FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_graph_proposals_app_be_insert ON public.agent_graph_proposals FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_graph_proposals_app_be_update ON public.agent_graph_proposals FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
GRANT SELECT, INSERT, UPDATE ON TABLE public.agent_graph_proposals TO app_be;

ALTER TABLE public.agent_graph_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_graph_decisions_app_be_select ON public.agent_graph_decisions FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_graph_decisions_app_be_insert ON public.agent_graph_decisions FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_graph_decisions_app_be_update ON public.agent_graph_decisions FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
GRANT SELECT, INSERT, UPDATE ON TABLE public.agent_graph_decisions TO app_be;
