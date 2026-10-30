-- knowledge-source-size-bytes: forward-only; immutable once on origin/main.
-- A source records the raw bytes it holds (the uploaded file, or the pasted text) so a workspace's Second Brain can be held to its 50 MB of raw data.
ALTER TABLE public.knowledge_sources ADD COLUMN IF NOT EXISTS size_bytes integer NOT NULL DEFAULT 0;

ALTER TABLE public.knowledge_sources DROP CONSTRAINT IF EXISTS knowledge_sources_size_bytes_check;
ALTER TABLE public.knowledge_sources ADD CONSTRAINT knowledge_sources_size_bytes_check CHECK (size_bytes >= 0);

-- Pasted notes and Q&A lists are their own raw text; the size of an uploaded file before this column is not known and stays 0.
UPDATE public.knowledge_sources
SET size_bytes = octet_length(content)
WHERE kind IN ('text', 'faq') AND size_bytes = 0;
