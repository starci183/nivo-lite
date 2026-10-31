-- knowledge-chunk-content-hash: forward-only; immutable once on origin/main. Expand step: one nullable column, nothing is dropped or tightened.
-- A passage records the SHA-256 of its normalised text and the model of its vector, so a passage that moved in its source keeps its vector and nothing is charged. A passage with no vector has no hash; a null hash behaves as before the column.
ALTER TABLE public.knowledge_chunks ADD COLUMN IF NOT EXISTS content_hash text;

-- Computed from the stored text, which the worker stored normalised; no vector is touched and nothing is embedded. Same value as passageHashOf.
UPDATE public.knowledge_chunks
SET content_hash = encode(sha256(convert_to(content || E'\n' || embedding_model, 'UTF8')), 'hex')
WHERE content_hash IS NULL
    AND embedding IS NOT NULL
    AND embedding_model IS NOT NULL;
