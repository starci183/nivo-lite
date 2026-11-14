-- drop-pgvector: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the VEC-CLEAN worker: the restart owner applies
-- it WITH the code of the same change (the code no longer reads or writes any column dropped here; applied without that code, the
-- old build would fail every passage and truth write; that code without this file fails the nivo_knowledge reads on the two new columns).
--
-- Owner's decision 2026-11-11, coordinator R61 (2026-11-14): Qdrant is the ONLY home of vectors, 1:1 with Postgres rows, kept in step by
-- the vector sync (outbox job + reconcile). Postgres keeps the rows, their text search (tsvector) and its record of what the index
-- accepted (`embedding_model`, the text hashes, `indexed_at`). This file removes the pgvector transition:
--   1. the `embedding extensions.vector(1536)` columns of knowledge_chunks, brain_facts and nivo_knowledge, with everything that names
--      them (HNSW indexes, partial indexes, checks, the generated `embedding_dimensions`);
--   2. NIVO's base knowledge becomes an embedded row kind of the index (kind `base`, tenant `platform`): nivo_knowledge gains the record
--      of its accepted point (`text_hash`, `indexed_at`) and the reconcile's state accepts the kind;
--   3. the re-embedding command (`knowledge.reembed`): the reconcile re-embeds a point of another model by itself, so the command, its job
--      and its GraphQL mutation left the source; its old command rows are removed so the narrowed check holds;
--   4. the `vector` extension, which nothing else uses (checked on dev: no column, function or operator outside the three columns).
-- db/pending/20261112015601_vector-index_contract_drop-pgvector.sql (the earlier, partial plan of point 1) is deleted with this file.
--
-- Data: on dev every column dropped here is NULL (0 vectors in Postgres; 15,416 passages and every wanted truth already indexed), so
-- nothing is re-embedded. nivo_knowledge rows (0 on dev) get their points from the reconcile (tick `vector-reconcile`) or the next
-- `cli seed-knowledge run`. Not reversible without an embedding pass.

-- 1. knowledge_chunks
DROP INDEX public.knowledge_chunks_embedding;
ALTER TABLE public.knowledge_chunks DROP CONSTRAINT knowledge_chunks_embedding_model_check;
ALTER TABLE public.knowledge_chunks DROP COLUMN embedding_dimensions;
ALTER TABLE public.knowledge_chunks DROP COLUMN embedding;
COMMENT ON COLUMN public.knowledge_chunks.embedding_model IS 'The embedding identity (<model>@<dimensions>) the passage was embedded with; its vector lives in the vector index only.';

-- 1. brain_facts
DROP INDEX public.brain_facts_embedding;
DROP INDEX public.brain_facts_embedding_model;
DROP INDEX public.brain_facts_embedding_hash;
DROP INDEX public.brain_facts_active_unembedded;
ALTER TABLE public.brain_facts DROP CONSTRAINT brain_facts_embedding_identity_check;
ALTER TABLE public.brain_facts DROP COLUMN embedding_dimensions;
ALTER TABLE public.brain_facts DROP COLUMN embedding;
COMMENT ON COLUMN public.brain_facts.embedding_model IS 'The embedding identity (<model>@<dimensions>) of the point the vector index accepted for the fact''s line; NULL = no point yet.';

-- 1. nivo_knowledge
DROP INDEX public.nivo_knowledge_embedding;
ALTER TABLE public.nivo_knowledge DROP CONSTRAINT nivo_knowledge_embedding_model_check;
ALTER TABLE public.nivo_knowledge DROP COLUMN embedding;

-- 2. the base knowledge as an embedded row kind
ALTER TABLE public.nivo_knowledge ADD COLUMN text_hash text;
ALTER TABLE public.nivo_knowledge ADD COLUMN indexed_at timestamp with time zone;
COMMENT ON COLUMN public.nivo_knowledge.embedding_model IS 'The embedding identity of the point the vector index accepted for the item; NULL = no point yet.';
COMMENT ON COLUMN public.nivo_knowledge.text_hash IS 'Hex sha256 of the normalised embedded text (title and body) of the accepted point; a different hash = the point is stale.';
COMMENT ON COLUMN public.nivo_knowledge.indexed_at IS 'When the vector index accepted the item''s point; NULL = found by words only until it does.';
UPDATE public.nivo_knowledge SET embedding_model = NULL WHERE embedding_model IS NOT NULL;

ALTER TABLE public.vector_sync_state DROP CONSTRAINT vector_sync_state_kind_check;
ALTER TABLE public.vector_sync_state ADD CONSTRAINT vector_sync_state_kind_check
    CHECK ((kind = ANY (ARRAY['passage'::text, 'truth'::text, 'base'::text])));

-- 3. the re-embedding command
DELETE FROM public.brain_commands WHERE kind = 'knowledge.reembed';
ALTER TABLE public.brain_commands DROP CONSTRAINT brain_commands_kind_check;
ALTER TABLE public.brain_commands ADD CONSTRAINT brain_commands_kind_check
    CHECK ((kind = ANY (ARRAY['fact.save'::text, 'fact.decide'::text, 'fact.keep'::text, 'lesson.save'::text, 'lesson.decide'::text, 'gap.dismiss'::text, 'brain.maintain'::text, 'lessons.mine'::text, 'source.delete'::text, 'source.reindex'::text, 'source.update'::text, 'knowledge.ask'::text, 'drive.linked'::text, 'drive.picked'::text])));

-- 4. the extension (no CASCADE: anything still using it refuses the drop)
DROP EXTENSION vector;
