-- brain-dossiers: forward-only; immutable once on origin/main.
-- The dossiers a workspace tracks in its Second Brain (the rows of a dossier checklist workbook): each belongs to one category (the top folder
-- of its documents), carries a status and what is still missing. Documents are matched to a dossier by category and reference, not by a key.
CREATE TABLE public.brain_dossiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    category text NOT NULL,
    category_order smallint NOT NULL,
    "position" smallint NOT NULL,
    ref text NOT NULL,
    name text NOT NULL,
    status text NOT NULL,
    existing text,
    missing text,
    drafts text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT brain_dossiers_workspace_ref_key UNIQUE (workspace_id, ref),
    CONSTRAINT brain_dossiers_status_check CHECK (status IN ('present', 'partial', 'drafted', 'missing', 'template')),
    CONSTRAINT brain_dossiers_category_order_check CHECK (category_order >= 0),
    CONSTRAINT brain_dossiers_position_check CHECK ("position" >= 0)
);
CREATE INDEX brain_dossiers_category_idx ON public.brain_dossiers USING btree (workspace_id, category_order, "position");
CREATE TRIGGER brain_dossiers_set_updated_at BEFORE UPDATE ON public.brain_dossiers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brain_dossiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY brain_dossiers_app_be_select ON public.brain_dossiers FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY brain_dossiers_app_be_insert ON public.brain_dossiers FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY brain_dossiers_app_be_update ON public.brain_dossiers FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY brain_dossiers_app_be_delete ON public.brain_dossiers FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.brain_dossiers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.brain_dossiers TO app_be;
