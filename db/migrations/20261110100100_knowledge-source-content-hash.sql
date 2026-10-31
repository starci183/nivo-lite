-- knowledge-source-content-hash: forward-only; immutable once on origin/main. Expand step: one nullable column, nothing is dropped or tightened.
-- A source records the SHA-256 of the extracted text whose passages and facts are complete, so the same text never pays for that work twice. The column is null while the work on a text is unfinished.
ALTER TABLE public.knowledge_sources ADD COLUMN IF NOT EXISTS content_hash text;

-- A source that went all the way already: the worker stores the text trimmed, so the hash of the stored text is the hash the worker computes. A note, a failure or a reading that did not finish leaves it null, and such a source goes through the full work once.
UPDATE public.knowledge_sources AS s
SET content_hash = encode(sha256(convert_to(s.content, 'UTF8')), 'hex')
WHERE s.content_hash IS NULL
    AND s.status = 'ready'
    AND s.error IS NULL
    AND s.content <> ''
    AND EXISTS (SELECT 1 FROM public.brain_extractions AS e WHERE e.source_id = s.id AND e.status = 'done');
