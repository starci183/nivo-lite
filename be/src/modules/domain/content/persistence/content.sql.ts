import { sql } from "@modules/platform/database"

/** The content themes of a workspace ($1 workspace). */
export const SELECT_PILLARS = sql`SELECT id, name, active
FROM public.content_pillars
WHERE workspace_id = $1
ORDER BY sort, created_at
LIMIT 100`

/** The channels a workspace posts to at least once a week ($1 workspace). */
export const SELECT_CADENCE_CHANNELS = sql`SELECT channel
FROM public.content_cadence
WHERE workspace_id = $1 AND posts_per_week > 0
ORDER BY channel
LIMIT 10`

/** The public, indexed knowledge sources shared with the content module that changed after an instant, oldest change first ($1 workspace, $2 instant). */
export const SELECT_FRESH_SOURCES = sql`SELECT id, title, topic, left(content, 400) AS excerpt,
       to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS changed_at
FROM public.knowledge_sources
WHERE workspace_id = $1 AND visibility = 'public' AND status IN ('ready', 'extracting_facts')
  AND (module IS NULL OR module = 'content') AND installation_id IS NULL AND updated_at > $2::timestamptz
ORDER BY updated_at
LIMIT 5`

/**
 * A line in the Office from NIVO ($1 workspace, $2 text). The Office feed is written by one definer function of the database, so this capability
 * never writes a table that is not its own; the function moves into the Office capability when that lands.
 */
export const INSERT_NOTICE = sql`SELECT public.post_office_notice($1, $2) AS posted`

/**
 * An evidence line of what NIVO did ($1 workspace, $2 kind, $3 summary, $4 evidence). The audit trail is written by one definer function of the
 * database, so this capability never writes a table that is not its own; the function moves into the audit capability when that lands.
 */
export const INSERT_EVIDENCE = sql`SELECT public.log_nivo_evidence($1, $2, $3, $4) AS logged`
