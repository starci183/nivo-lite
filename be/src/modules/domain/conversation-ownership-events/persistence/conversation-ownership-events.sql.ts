import { sql } from "@modules/platform/database"

/** Records one ownership move ($1 workspace, $2 conversation, $3 from agent, $4 to agent, $5 reason). */
export const INSERT_OWNERSHIP_EVENT = sql`INSERT INTO public.conversation_ownership_events (workspace_id, conversation_id, from_agent_id, to_agent_id, reason)
VALUES ($1, $2, $3, $4, $5)`
