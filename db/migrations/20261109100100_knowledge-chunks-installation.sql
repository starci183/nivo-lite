-- A passage carries the agent instance of its source, so the passage search filters by instance without reading the sources table.
ALTER TABLE public.knowledge_chunks ADD COLUMN IF NOT EXISTS installation_id uuid;

UPDATE public.knowledge_chunks c
SET installation_id = s.installation_id
FROM public.knowledge_sources s
WHERE s.id = c.source_id AND s.installation_id IS NOT NULL AND c.installation_id IS DISTINCT FROM s.installation_id;

CREATE INDEX IF NOT EXISTS knowledge_chunks_installation ON public.knowledge_chunks (workspace_id, installation_id)
    WHERE installation_id IS NOT NULL;
