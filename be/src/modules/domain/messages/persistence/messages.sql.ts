import { sql } from "@modules/platform/database"

/** Posts one NIVO line in the team chat of a workspace ($1 workspace, $2 lead or null, $3 body). */
export const INSERT_SYSTEM_MESSAGE = sql`INSERT INTO public.messages (workspace_id, lead_id, author_kind, author_name, body)
VALUES ($1, $2, 'system', 'NIVO', $3)`
