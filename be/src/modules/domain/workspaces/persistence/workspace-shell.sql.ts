import { sql } from "@modules/platform/database"

/** Everything the console frame reads, in one request ($1 workspace, $2 founding window start, $3 end). */
export const READ_SHELL = sql`SELECT public.shell_data($1, $2, $3) AS data`
