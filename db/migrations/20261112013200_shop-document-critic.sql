-- shop-document-critic: forward-only; immutable once on origin/main. Expand only.
-- The deep critic of a SHOP document (BG3, owner 2026-11-11: "có hệ thống phản biện sâu để check sạn tài liệu up lên lần đầu. Lần sau up
-- lên thì check sạn và sửa partial graph"):
-- 1. public.brain_source_critiques: where the critique of each document stands (waiting / running / done / not_done + reason), the hashes
--    of the passages a finished critique read (a later upload is critiqued only outside them), the model calls and tokens it used, and
--    the founder's release of a document whose critique could not finish. One row per document; it goes with the document.
--    The points themselves live in public.dossier_findings with dossier_id NULL and rule_key 'shop.<kind>' (the dossier review never
--    reconciles those rule keys).
-- 2. knowledge_chunks.customer_ready: THE TRUST GATE. A passage is served to CUSTOMER-facing searches only when true. New rows are false
--    (the index job inserts withheld passages); the critic sets true once the document's facts are read and its critique ran, except on
--    passages under an open HIGH point. Every passage stored before this migration is backfilled TRUE (added with DEFAULT true, a metadata
--    change, then the default becomes false): nothing a customer agent reads today goes dark the night this lands.
--    Index: the customer search reads (workspace_id) WHERE visibility = 'public' AND customer_ready; the release writes by (source_id, ord)
--    (existing knowledge_chunks_source).

CREATE TABLE public.brain_source_critiques (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    source_id uuid NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
    state text NOT NULL DEFAULT 'waiting',
    reason text,
    attempts smallint NOT NULL DEFAULT 0,
    reviewed_hashes text[] NOT NULL DEFAULT '{}'::text[],
    model_calls integer NOT NULL DEFAULT 0,
    prompt_tokens integer NOT NULL DEFAULT 0,
    requested_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    finished_at timestamptz,
    released_by uuid,
    released_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT brain_source_critiques_source_key UNIQUE (workspace_id, source_id),
    CONSTRAINT brain_source_critiques_state_check CHECK (state IN ('waiting', 'running', 'done', 'not_done')),
    CONSTRAINT brain_source_critiques_reason_check CHECK (
        (state = 'not_done') = (reason IS NOT NULL) AND (reason IS NULL OR reason IN ('model', 'credits', 'facts_unread', 'budget'))
    ),
    CONSTRAINT brain_source_critiques_attempts_check CHECK (attempts BETWEEN 0 AND 3),
    CONSTRAINT brain_source_critiques_counts_check CHECK (model_calls >= 0 AND prompt_tokens >= 0)
);
CREATE INDEX brain_source_critiques_waiting ON public.brain_source_critiques USING btree (workspace_id, requested_at) WHERE state = 'waiting';
CREATE INDEX brain_source_critiques_recent ON public.brain_source_critiques USING btree (workspace_id, finished_at);

CREATE TRIGGER brain_source_critiques_set_updated_at BEFORE UPDATE ON public.brain_source_critiques FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.brain_source_critiques ENABLE ROW LEVEL SECURITY;
CREATE POLICY brain_source_critiques_app_be_select ON public.brain_source_critiques FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY brain_source_critiques_app_be_insert ON public.brain_source_critiques FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY brain_source_critiques_app_be_update ON public.brain_source_critiques FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY brain_source_critiques_app_be_delete ON public.brain_source_critiques FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.brain_source_critiques FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.brain_source_critiques TO app_be;

ALTER TABLE public.knowledge_chunks ADD COLUMN customer_ready boolean NOT NULL DEFAULT true;
ALTER TABLE public.knowledge_chunks ALTER COLUMN customer_ready SET DEFAULT false;
COMMENT ON COLUMN public.knowledge_chunks.customer_ready IS 'Trust gate (BG3): served to customer-facing searches only when true; set by the shop-document critic.';
CREATE INDEX knowledge_chunks_customer ON public.knowledge_chunks USING btree (workspace_id) WHERE visibility = 'public' AND customer_ready;
