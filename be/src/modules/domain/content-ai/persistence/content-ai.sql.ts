import { sql } from "@modules/platform/database"

/** Applied content setup is scoped to the same workspace on both sides of the join. */
export const SELECT_CONTENT_SETUP = sql`SELECT v.snapshot FROM public.module_installations i
JOIN public.module_context_versions v ON v.id = i.active_context_version_id AND v.workspace_id = i.workspace_id
WHERE i.workspace_id = $1 AND i.module_key = 'content' ORDER BY i.created_at LIMIT 1`

/** Marketing may use only shared public indexed sources assigned to content or every module. */
export const SELECT_CONTENT_PUBLIC_SOURCES = sql`SELECT title, topic, content FROM public.knowledge_sources
WHERE workspace_id = $1 AND visibility = 'public' AND status IN ('ready', 'extracting_facts')
AND (module IS NULL OR module = 'content') AND installation_id IS NULL
ORDER BY created_at LIMIT 40`
