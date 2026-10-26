import { sql } from "@modules/platform/database"

/** The story's footprints under both workspaces ($1 workspaces each). */
export const CLEAN_MESSAGES = sql`DELETE FROM public.messages WHERE workspace_id = ANY($1::uuid[])`
export const CLEAN_AGENT_CHAT = sql`WITH gone AS (DELETE FROM public.agent_messages WHERE workspace_id = ANY($1::uuid[]))
DELETE FROM public.agent_conversations WHERE workspace_id = ANY($1::uuid[])`
export const CLEAN_READS = sql`DELETE FROM public.office_rooms_reads WHERE workspace_id = ANY($1::uuid[])`
export const CLEAN_MEMBERS = sql`DELETE FROM public.workspace_members WHERE workspace_id = ANY($1::uuid[])`
export const CLEAN_WORKSPACES = sql`DELETE FROM public.workspaces WHERE id = ANY($1::uuid[])`
export const CLEAN_AGENTS = sql`DELETE FROM public.agents WHERE id = ANY($1::uuid[])`
export const CLEAN_LEADS = sql`DELETE FROM public.leads WHERE id = ANY($1::uuid[])`

/** Marker rows a conversation-read writes ($1 workspace, $2 marker key). */
export const MARKERS_OF = sql`
    SELECT count(*)::int AS n FROM public.office_rooms_reads WHERE workspace_id = $1 AND room = $2`
