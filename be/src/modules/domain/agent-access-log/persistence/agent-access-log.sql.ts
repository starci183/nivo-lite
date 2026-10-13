import { sql } from "@modules/platform/database"

/** Logs one change of access: who, when, before, after. */
export const INSERT_AGENT_ACCESS_LOG = sql`INSERT INTO public.agent_access_log (workspace_id, connection_id, agent_id, connection_name, agent_name, before_access, after_access, changed_by, changed_by_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
