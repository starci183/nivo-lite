-- knowledge-sources: a document whose facts are read stays `ready` while the critic checks its dossier, and wears the stage `critic` meanwhile so the fourth step of taking a document in lights up. Additive: the check is widened by one value; no row changes.

ALTER TABLE public.knowledge_sources DROP CONSTRAINT knowledge_sources_stage_check;
ALTER TABLE public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_stage_check
    CHECK (stage IS NULL OR stage IN ('read', 'chunk', 'embed', 'store', 'facts', 'critic'));
