import { sql } from "@modules/platform/database"

/** The document a configuration run kept with this title, locked for the run ($1 workspace, $2 origin, $3 title). */
export const FIND_PROFILE_SOURCE = sql`SELECT id, content FROM public.knowledge_sources
WHERE workspace_id = $1 AND origin = $2 AND title = $3
ORDER BY created_at
LIMIT 1
FOR UPDATE`
