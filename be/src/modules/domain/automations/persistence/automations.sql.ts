import { sql } from "@modules/platform/database"

/** Every row the automations screen reads, in one call ($1 workspace). */
export const SELECT_OVERVIEW = sql`SELECT public.automations_data($1) AS data`
