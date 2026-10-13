import { sql } from "@modules/platform/database"

/** What a workspace decided about its suggestions ($1 workspace). */
export const LIST_SUGGESTION_STATES = sql`SELECT suggestion_key, state FROM public.knowledge_suggestion_state WHERE workspace_id = $1 LIMIT 200`

/** The business type of a workspace ($1 workspace). */
export const SELECT_BUSINESS_TYPE = sql`SELECT business_type FROM public.workspaces WHERE id = $1 LIMIT 1`

/** Records or changes a decision ($1 workspace, $2 key, $3 state, $4 who decided). */
export const UPSERT_SUGGESTION_STATE = sql`INSERT INTO public.knowledge_suggestion_state (workspace_id, suggestion_key, state, decided_by, decided_at)
VALUES ($1, $2, $3, $4, now())
ON CONFLICT (workspace_id, suggestion_key) DO UPDATE SET state = excluded.state, decided_by = excluded.decided_by, decided_at = excluded.decided_at`

/** Takes a decision back so the suggestion returns ($1 workspace, $2 key). */
export const DELETE_SUGGESTION_STATE = sql`DELETE FROM public.knowledge_suggestion_state WHERE workspace_id = $1 AND suggestion_key = $2`
