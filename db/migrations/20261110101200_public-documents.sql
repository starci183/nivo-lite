-- public-documents: what customers may read is written apart from what the team knows. Expand only: two new tables, nothing existing altered.
-- A public document is its own text. NIVO drafts it from internal documents while no customer is present, lists what it left out, and the
-- owner approves; only then does a knowledge_sources row with visibility 'public' exist for it (origin 'public_document'). The document
-- records who approved, when, and the internal sources with the hash each had when it was drafted, so a change of a source is seen later.
-- public_document_sources.source_id carries no foreign key: a deleted source must stay visible as a source that changed.
-- gap_id is unique: one customer question gets at most one proposal.

CREATE TABLE public.public_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL DEFAULT '',
    published_body text,
    published_revision integer,
    kind text NOT NULL DEFAULT 'written',
    status text NOT NULL DEFAULT 'draft',
    draft_revision integer NOT NULL DEFAULT 0,
    question text,
    gap_id uuid REFERENCES public.knowledge_gaps(id) ON DELETE SET NULL,
    instructions text,
    left_out jsonb NOT NULL DEFAULT '[]'::jsonb,
    failure_code text,
    approved_by uuid,
    approved_by_name text,
    approved_at timestamptz,
    published_source_id uuid,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT public_documents_kind_check CHECK (kind IN ('drafted', 'written', 'answer')),
    CONSTRAINT public_documents_status_check CHECK (status IN ('drafting', 'draft', 'published', 'archived', 'failed')),
    CONSTRAINT public_documents_revision_check CHECK (draft_revision >= 0),
    CONSTRAINT public_documents_left_out_check CHECK (jsonb_typeof(left_out) = 'array'),
    CONSTRAINT public_documents_published_check CHECK (status <> 'published' OR (published_body IS NOT NULL AND published_revision IS NOT NULL AND approved_at IS NOT NULL AND approved_by IS NOT NULL))
);
CREATE INDEX public_documents_workspace_idx ON public.public_documents USING btree (workspace_id, updated_at DESC) WHERE status <> 'archived';
CREATE UNIQUE INDEX public_documents_gap_key ON public.public_documents USING btree (gap_id) WHERE gap_id IS NOT NULL;

CREATE TABLE public.public_document_sources (
    document_id uuid NOT NULL REFERENCES public.public_documents(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    source_id uuid NOT NULL,
    source_title text NOT NULL,
    content_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT public_document_sources_pkey PRIMARY KEY (document_id, source_id)
);
CREATE INDEX public_document_sources_source_idx ON public.public_document_sources USING btree (workspace_id, source_id);

-- Approval history is append-only for the application role. An individual document with approvals cannot be deleted; whole-workspace
-- cleanup removes both through their workspace foreign keys. Deferred no-action references avoid cascade-order dependence in that cleanup.
CREATE TABLE public.public_document_approvals (
    document_id uuid NOT NULL REFERENCES public.public_documents(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
    draft_revision integer NOT NULL CHECK (draft_revision >= 0),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL,
    draft_sources jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(draft_sources) = 'array'),
    reviewed_sources jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(reviewed_sources) = 'array'),
    approved_by uuid NOT NULL,
    approved_by_name text,
    approved_at timestamptz NOT NULL,
    CONSTRAINT public_document_approvals_pkey PRIMARY KEY (document_id, draft_revision)
);
ALTER TABLE public.public_documents ADD CONSTRAINT public_documents_approved_revision_fkey
    FOREIGN KEY (id, published_revision) REFERENCES public.public_document_approvals(document_id, draft_revision) DEFERRABLE INITIALLY DEFERRED;

CREATE TRIGGER public_documents_set_updated_at BEFORE UPDATE ON public.public_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER public_document_sources_set_updated_at BEFORE UPDATE ON public.public_document_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.public_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_documents_app_be_select ON public.public_documents FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY public_documents_app_be_insert ON public.public_documents FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY public_documents_app_be_update ON public.public_documents FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY public_documents_app_be_delete ON public.public_documents FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.public_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_documents TO app_be;

ALTER TABLE public.public_document_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_document_sources_app_be_select ON public.public_document_sources FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY public_document_sources_app_be_insert ON public.public_document_sources FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY public_document_sources_app_be_update ON public.public_document_sources FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY public_document_sources_app_be_delete ON public.public_document_sources FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.public_document_sources FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_document_sources TO app_be;

ALTER TABLE public.public_document_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_document_approvals_app_be_select ON public.public_document_approvals FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY public_document_approvals_app_be_insert ON public.public_document_approvals FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.public_document_approvals FROM PUBLIC, anon, authenticated, app_be;
GRANT SELECT, INSERT ON TABLE public.public_document_approvals TO app_be;
