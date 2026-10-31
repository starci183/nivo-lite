-- dossier-review: forward-only; immutable once on origin/main.
-- The findings of the dossier review of a workspace's Second Brain, its runs, the status it computes per dossier and the
-- remedy drafts NIVO writes for the owner to approve.
CREATE TABLE public.dossier_review_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    scope text NOT NULL,
    dossier_id uuid REFERENCES public.brain_dossiers(id) ON DELETE CASCADE,
    trigger text NOT NULL,
    trigger_ref uuid,
    status text NOT NULL DEFAULT 'queued',
    requested_by uuid,
    ai_state text,
    stats jsonb NOT NULL DEFAULT '{}'::jsonb,
    error text,
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dossier_review_runs_scope_check CHECK (scope IN ('dossier', 'workspace')),
    CONSTRAINT dossier_review_runs_scope_dossier_check CHECK ((scope = 'dossier') = (dossier_id IS NOT NULL)),
    CONSTRAINT dossier_review_runs_trigger_check CHECK (trigger IN ('document', 'document_gone', 'request')),
    CONSTRAINT dossier_review_runs_status_check CHECK (status IN ('queued', 'running', 'done', 'failed')),
    CONSTRAINT dossier_review_runs_ai_state_check CHECK (ai_state IS NULL OR ai_state IN ('done', 'partial', 'skipped_unchanged', 'skipped_credits', 'skipped_budget', 'failed'))
);
CREATE UNIQUE INDEX dossier_review_runs_one_queued ON public.dossier_review_runs
    (workspace_id, COALESCE(dossier_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE status = 'queued';
CREATE UNIQUE INDEX dossier_review_runs_one_running ON public.dossier_review_runs (workspace_id) WHERE status = 'running';
CREATE INDEX dossier_review_runs_recent_idx ON public.dossier_review_runs USING btree (workspace_id, created_at DESC);

CREATE TABLE public.dossier_findings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    dossier_id uuid REFERENCES public.brain_dossiers(id) ON DELETE CASCADE,
    related_dossier_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
    kind text NOT NULL,
    severity text NOT NULL,
    origin text NOT NULL,
    rule_key text NOT NULL,
    fingerprint text NOT NULL,
    code text,
    params jsonb NOT NULL DEFAULT '{}'::jsonb,
    title text NOT NULL,
    detail text NOT NULL,
    evidence jsonb NOT NULL,
    evidence_hash text NOT NULL,
    source_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
    fact_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
    remedy_action text NOT NULL,
    remedy_document_type text,
    status text NOT NULL DEFAULT 'open',
    resolution text,
    dismiss_reason text,
    dismissed_evidence_hash text,
    reopened_count smallint NOT NULL DEFAULT 0,
    decided_by uuid,
    decided_at timestamptz,
    decision_note text,
    assignee_id uuid,
    due_at date,
    first_seen_run_id uuid,
    last_seen_run_id uuid,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dossier_findings_workspace_fingerprint_key UNIQUE (workspace_id, fingerprint),
    CONSTRAINT dossier_findings_kind_check CHECK (kind IN ('contradiction', 'missing', 'expired', 'unsigned', 'outdated', 'unreasonable')),
    CONSTRAINT dossier_findings_severity_check CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    CONSTRAINT dossier_findings_origin_check CHECK (origin IN ('rule', 'ai')),
    CONSTRAINT dossier_findings_ai_severity_check CHECK (origin = 'rule' OR severity <> 'critical'),
    CONSTRAINT dossier_findings_remedy_check CHECK (remedy_action IN ('upload', 'draft', 'decide', 'external')),
    CONSTRAINT dossier_findings_status_check CHECK (status IN ('open', 'confirmed', 'dismissed', 'resolved')),
    CONSTRAINT dossier_findings_resolution_check CHECK (resolution IS NULL OR resolution IN ('document', 'draft', 'not_detected', 'manual')),
    CONSTRAINT dossier_findings_resolved_check CHECK ((status = 'resolved') = (resolution IS NOT NULL)),
    CONSTRAINT dossier_findings_dismissed_check CHECK (status <> 'dismissed' OR dismiss_reason IS NOT NULL),
    CONSTRAINT dossier_findings_evidence_check CHECK (jsonb_typeof(evidence) = 'array' AND jsonb_array_length(evidence) BETWEEN 1 AND 8),
    CONSTRAINT dossier_findings_text_check CHECK (char_length(title) <= 200 AND char_length(detail) <= 1000)
);
CREATE INDEX dossier_findings_status_idx ON public.dossier_findings USING btree (workspace_id, status, severity);
CREATE INDEX dossier_findings_dossier_idx ON public.dossier_findings USING btree (dossier_id, status);
CREATE INDEX dossier_findings_sources_idx ON public.dossier_findings USING gin (source_ids);

CREATE TABLE public.dossier_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    dossier_id uuid NOT NULL REFERENCES public.brain_dossiers(id) ON DELETE CASCADE,
    status text NOT NULL,
    open_count integer NOT NULL DEFAULT 0,
    critical_count integer NOT NULL DEFAULT 0,
    high_count integer NOT NULL DEFAULT 0,
    actual_documents integer NOT NULL DEFAULT 0,
    draft_documents integer NOT NULL DEFAULT 0,
    template_documents integer NOT NULL DEFAULT 0,
    inputs_fingerprint text,
    last_run_id uuid,
    reviewed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dossier_reviews_dossier_key UNIQUE (dossier_id),
    CONSTRAINT dossier_reviews_status_check CHECK (status IN ('present', 'partial', 'drafted', 'missing', 'template'))
);
CREATE INDEX dossier_reviews_workspace_idx ON public.dossier_reviews USING btree (workspace_id);

CREATE TABLE public.dossier_remedy_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    finding_id uuid NOT NULL REFERENCES public.dossier_findings(id) ON DELETE CASCADE,
    dossier_id uuid REFERENCES public.brain_dossiers(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'generating',
    instructions text,
    title text NOT NULL DEFAULT '',
    document_type text NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '',
    placeholders jsonb NOT NULL DEFAULT '[]'::jsonb,
    model text,
    error text,
    source_id uuid REFERENCES public.knowledge_sources(id) ON DELETE SET NULL,
    requested_by uuid NOT NULL,
    decided_by uuid,
    decided_at timestamptz,
    reject_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dossier_remedy_drafts_status_check CHECK (status IN ('generating', 'proposed', 'approved', 'rejected', 'failed')),
    CONSTRAINT dossier_remedy_drafts_text_check CHECK (char_length(title) <= 200 AND char_length(body) <= 45000 AND (instructions IS NULL OR char_length(instructions) <= 1000))
);
CREATE UNIQUE INDEX dossier_remedy_drafts_one_active ON public.dossier_remedy_drafts (finding_id) WHERE status IN ('generating', 'proposed');
CREATE INDEX dossier_remedy_drafts_workspace_idx ON public.dossier_remedy_drafts USING btree (workspace_id, status, created_at DESC);

CREATE TRIGGER dossier_review_runs_set_updated_at BEFORE UPDATE ON public.dossier_review_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER dossier_findings_set_updated_at BEFORE UPDATE ON public.dossier_findings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER dossier_reviews_set_updated_at BEFORE UPDATE ON public.dossier_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER dossier_remedy_drafts_set_updated_at BEFORE UPDATE ON public.dossier_remedy_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.dossier_review_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY dossier_review_runs_app_be_select ON public.dossier_review_runs FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY dossier_review_runs_app_be_insert ON public.dossier_review_runs FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY dossier_review_runs_app_be_update ON public.dossier_review_runs FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY dossier_review_runs_app_be_delete ON public.dossier_review_runs FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.dossier_review_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dossier_review_runs TO app_be;

ALTER TABLE public.dossier_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY dossier_findings_app_be_select ON public.dossier_findings FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY dossier_findings_app_be_insert ON public.dossier_findings FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY dossier_findings_app_be_update ON public.dossier_findings FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY dossier_findings_app_be_delete ON public.dossier_findings FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.dossier_findings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dossier_findings TO app_be;

ALTER TABLE public.dossier_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY dossier_reviews_app_be_select ON public.dossier_reviews FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY dossier_reviews_app_be_insert ON public.dossier_reviews FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY dossier_reviews_app_be_update ON public.dossier_reviews FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY dossier_reviews_app_be_delete ON public.dossier_reviews FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.dossier_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dossier_reviews TO app_be;

ALTER TABLE public.dossier_remedy_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY dossier_remedy_drafts_app_be_select ON public.dossier_remedy_drafts FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY dossier_remedy_drafts_app_be_insert ON public.dossier_remedy_drafts FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY dossier_remedy_drafts_app_be_update ON public.dossier_remedy_drafts FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY dossier_remedy_drafts_app_be_delete ON public.dossier_remedy_drafts FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.dossier_remedy_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dossier_remedy_drafts TO app_be;
