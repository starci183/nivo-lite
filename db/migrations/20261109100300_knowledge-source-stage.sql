-- knowledge-source-stage: forward-only; immutable once on origin/main. Expand step: columns only, nothing is dropped or tightened.
-- A source records the stage its worker is on (read, chunk, embed, store, facts) and, for the embed stage, how many passages have their vector of how many, so the Knowledge page shows the work live and a reload converges on the same state.
ALTER TABLE public.knowledge_sources ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE public.knowledge_sources ADD COLUMN IF NOT EXISTS stage_done integer;
ALTER TABLE public.knowledge_sources ADD COLUMN IF NOT EXISTS stage_total integer;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'knowledge_sources_stage_check' AND conrelid = 'public.knowledge_sources'::regclass
    ) THEN
        ALTER TABLE public.knowledge_sources ADD CONSTRAINT knowledge_sources_stage_check
            CHECK (stage IS NULL OR stage IN ('read', 'chunk', 'embed', 'store', 'facts'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'knowledge_sources_stage_counts_check' AND conrelid = 'public.knowledge_sources'::regclass
    ) THEN
        ALTER TABLE public.knowledge_sources ADD CONSTRAINT knowledge_sources_stage_counts_check
            CHECK ((stage_done IS NULL OR stage_done >= 0) AND (stage_total IS NULL OR stage_total >= 0));
    END IF;
END
$$;
