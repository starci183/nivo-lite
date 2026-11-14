-- vector-index_contract_drop-pgvector: CONTRACT half of 20261112015600_vector-index-sync.sql.
--
-- NOT TO APPLY. This file is kept in db/pending/ ON PURPOSE: `starci app db migrate` applies every file of db/migrations/, so a file
-- there would drop the vectors at the next restart, before the Qdrant path is verified live. The coordinator moves it into
-- db/migrations/ (same name) ONLY when ALL of these hold, and in the SAME change as the code edits listed below (destructive DDL is
-- accepted only after the code stops using the target, BE-PERSISTENCE-19, R255):
--   1. dev and production run with QDRANT_URL set, and the readiness probe says `vectors: ok`;
--   2. a whole pass of the reconcile ended clean for both kinds (log `vector.reconcile.done`: rowsWrapped, embedded 0, copied 0,
--      failed 0; `vector_sync_state.passes >= 1`, `drift_runs = 0`);
--   3. the counts agree: points of `nivo_passages` = rows of knowledge_chunks with indexed_at; points of `nivo_truths` = rows of
--      brain_facts in ('active','proposed') with indexed_at;
--   4. a customer-facing and an internal meaning search answer from the index (answer `legs` holds `meaning`), and the same-truth
--      check finds its candidates;
--   5. the owner accepts that from here a rebuild of the index re-embeds (about 1.2 USD per 200,000 passages) and that going back
--      to pgvector is no longer a switch.
--
-- Code that goes in the same change (all read or write the columns dropped here):
--   * entities: `KnowledgeChunkEntity.embedding`, `BrainFactEntity.embedding`, `BrainFactEntity.embeddingDimensions`;
--   * the transition reads: `PassageVectorRowsService.storedVectors`, `FactVectorRowsService.storedVectors` (answer an empty map),
--     and the `embedding = CASE ...` member of both `stamp` writes;
--   * the pgvector statements behind the switch: `PassageSearchService.byMeaning`, `BrainFactEmbeddingsService.nearest` /
--     `nearestTo` / `store` / `storeMany` / `adopt` / `wanting` / `workspacesWanting` / `ofOtherIdentity`, `FactVectorsSweepService`,
--     `KnowledgeChunksService.setVectors` and the `c.embedding` halves of `embeddedOf` / `stale` / `passagesOf`,
--     `KnowledgeReembedService` (the reconcile re-embeds another model's points);
--   * `QDRANT_URL` becomes required (`parseQdrantConfig`), since no other store is left.
-- NOT covered: `public.nivo_knowledge.embedding` (NIVO's own base knowledge, another table and another search) stays on pgvector.
--
-- What it drops, in dependency order (the generated dimensions depend on the vector; the indexes and checks name it):
--   knowledge_chunks: HNSW `knowledge_chunks_embedding`, check `knowledge_chunks_embedding_model_check`, generated
--     `embedding_dimensions`, column `embedding`. Kept: `embedding_model`, `content_hash`, `text_hash`, `indexed_at`,
--     `knowledge_chunks_model (workspace_id, embedding_model)`.
--   brain_facts: HNSW `brain_facts_embedding`, `brain_facts_embedding_model` and `brain_facts_embedding_hash` (both partial on
--     `embedding IS NOT NULL`; `brain_facts_indexed_hash` of 015600 replaces the second), `brain_facts_active_unembedded` (partial on
--     `embedding IS NULL`: the sweep it served is gone), check `brain_facts_embedding_identity_check`, generated
--     `embedding_dimensions`, column `embedding`. Kept: `embedding_model`, `embedding_hash`, `indexed_at`.
-- Data: the vectors are deleted from Postgres. They are a projection Qdrant holds; nothing else is lost. Not reversible without an
-- embedding pass.

DROP INDEX public.knowledge_chunks_embedding;
ALTER TABLE public.knowledge_chunks DROP CONSTRAINT knowledge_chunks_embedding_model_check;
ALTER TABLE public.knowledge_chunks DROP COLUMN embedding_dimensions;
ALTER TABLE public.knowledge_chunks DROP COLUMN embedding;

DROP INDEX public.brain_facts_embedding;
DROP INDEX public.brain_facts_embedding_model;
DROP INDEX public.brain_facts_embedding_hash;
DROP INDEX public.brain_facts_active_unembedded;
ALTER TABLE public.brain_facts DROP CONSTRAINT brain_facts_embedding_identity_check;
ALTER TABLE public.brain_facts DROP COLUMN embedding_dimensions;
ALTER TABLE public.brain_facts DROP COLUMN embedding;
