import { sql } from "@modules/platform/database"

/** Adds the admitted API text with its stable source identity and no impersonated creator ($1 source, $2 workspace, $3 topic, $4 tags, $5 visibility, $6 title, $7 content, $8 origin). */
export const INSERT_API_TEXT_SOURCE = sql`WITH changed AS (
    INSERT INTO public.knowledge_sources
        (id, workspace_id, kind, topic, tags, visibility, title, content, status, progress, origin, created_by)
    VALUES ($1, $2, 'text', $3, $4::text[], $5, $6, $7, 'queued', 0, $8, NULL)
    RETURNING id
)
SELECT id FROM changed`
