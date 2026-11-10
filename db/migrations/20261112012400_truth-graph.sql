-- truth-graph: forward-only; immutable once on origin/main. Expand only: nothing is dropped, every new column is nullable.
-- The truth graph on public.brain_facts (owner, 2026-11-10: "UPGRADE brain_facts, no new graph engine"):
-- 1. version: which value of its key a fact is (1 on the first activation, +1 on each replacement). Backfill: the facts that were ever
--    in force (active, superseded, expired, scheduled) are numbered per key in the order they were decided.
-- 2. validity: every truth holds ONE YEAR unless a shorter period is stated. The code sets valid_to on approval; here the truths in
--    force (or scheduled) with no end get one: one year after they started, and never sooner than 30 days from this migration (no
--    truth of a live shop expires the night it lands; dev held 0 active facts on 2026-11-11).
-- 3. relations: public.brain_fact_relations, the edges of the graph, both ends facts of the SAME workspace (composite keys), cascade on
--    either end, one edge of a kind per ordered pair, never a fact to itself. Row security like every app_be table.
-- 4. chunk provenance needs no column: document evidence items carry "chunkHash" and the existing GIN index brain_facts_evidence
--    (jsonb_path_ops) serves "facts born from chunk X" (evidence @> '[{"kind":"document","ref":…,"chunkHash":…}]').
-- 5. embedding standard (LG-REQUESTS "W2: embedding standard for the truth graph"): a fact's vector lives with its identity
--    (embedding_model), the hash of the embedded text (embedding_hash) and its dimensions, computed by the database from the vector
--    itself (embedding_dimensions, generated). knowledge_chunks gets the same generated dimensions column; it already records
--    embedding_model and content_hash.

ALTER TABLE public.brain_facts ADD COLUMN version integer;
ALTER TABLE public.brain_facts ADD CONSTRAINT brain_facts_version_check CHECK (((version IS NULL) OR (version >= 1)));

WITH numbered AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY workspace_id, subject_key, attribute, COALESCE(installation_id, '00000000-0000-0000-0000-000000000000'::uuid)
               ORDER BY COALESCE(decided_at, proposed_at), id
           ) AS n
      FROM public.brain_facts
     WHERE status IN ('active', 'superseded', 'expired', 'scheduled')
)
UPDATE public.brain_facts f SET version = numbered.n FROM numbered WHERE f.id = numbered.id;

UPDATE public.brain_facts
   SET valid_to = GREATEST(
           COALESCE(valid_from, decided_at, proposed_at) + interval '1 year',
           now() + interval '30 days'
       )
 WHERE status IN ('active', 'scheduled') AND valid_to IS NULL;

ALTER TABLE public.brain_facts ADD CONSTRAINT brain_facts_workspace_id_id_unique UNIQUE (workspace_id, id);

CREATE TABLE public.brain_fact_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    from_fact_id uuid NOT NULL,
    to_fact_id uuid NOT NULL,
    kind text NOT NULL,
    label text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brain_fact_relations_from_fkey FOREIGN KEY (workspace_id, from_fact_id)
        REFERENCES public.brain_facts(workspace_id, id) ON DELETE CASCADE,
    CONSTRAINT brain_fact_relations_to_fkey FOREIGN KEY (workspace_id, to_fact_id)
        REFERENCES public.brain_facts(workspace_id, id) ON DELETE CASCADE,
    CONSTRAINT brain_fact_relations_not_self CHECK ((from_fact_id <> to_fact_id)),
    CONSTRAINT brain_fact_relations_kind_check CHECK ((kind = ANY (ARRAY['part_of'::text, 'applies_to'::text, 'depends_on'::text, 'exception_of'::text, 'related'::text]))),
    CONSTRAINT brain_fact_relations_label_check CHECK (((label IS NULL) OR (char_length(label) <= 80))),
    CONSTRAINT brain_fact_relations_edge_unique UNIQUE (workspace_id, from_fact_id, to_fact_id, kind)
);

CREATE INDEX brain_fact_relations_to ON public.brain_fact_relations USING btree (workspace_id, to_fact_id);

CREATE TRIGGER brain_fact_relations_set_updated_at BEFORE UPDATE ON public.brain_fact_relations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brain_fact_relations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.brain_fact_relations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.brain_fact_relations TO app_be;
CREATE POLICY brain_fact_relations_app_be_select ON public.brain_fact_relations FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));
CREATE POLICY brain_fact_relations_app_be_insert ON public.brain_fact_relations FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY brain_fact_relations_app_be_update ON public.brain_fact_relations FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY brain_fact_relations_app_be_delete ON public.brain_fact_relations FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

ALTER TABLE public.brain_facts ADD COLUMN embedding extensions.vector(1536);
ALTER TABLE public.brain_facts ADD COLUMN embedding_model text;
ALTER TABLE public.brain_facts ADD COLUMN embedding_hash text;
ALTER TABLE public.brain_facts ADD COLUMN embedding_dimensions integer GENERATED ALWAYS AS (extensions.vector_dims(embedding)) STORED;
ALTER TABLE public.brain_facts ADD CONSTRAINT brain_facts_embedding_identity_check
    CHECK (((embedding IS NULL) OR ((embedding_model IS NOT NULL) AND (embedding_hash IS NOT NULL))));
CREATE INDEX brain_facts_embedding_model ON public.brain_facts USING btree (workspace_id, embedding_model) WHERE (embedding IS NOT NULL);
CREATE INDEX brain_facts_embedding ON public.brain_facts USING hnsw (embedding extensions.vector_cosine_ops) WHERE (status = 'active'::text);

ALTER TABLE public.knowledge_chunks ADD COLUMN embedding_dimensions integer GENERATED ALWAYS AS (extensions.vector_dims(embedding)) STORED;
