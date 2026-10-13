import { sql } from "@modules/platform/database"

/** Notes that a workspace wants a connector; a second note of the same connector changes nothing. */
export const INSERT_CONNECTOR_INTEREST = sql`INSERT INTO public.connector_interest (workspace_id, connector_id, user_id) VALUES ($1, $2, $3) ON CONFLICT (workspace_id, connector_id) DO NOTHING`
