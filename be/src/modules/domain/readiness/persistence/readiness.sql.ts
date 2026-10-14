import { sql } from "@modules/platform/database"

/** Proves the primary connection can answer without reading or mutating application data. */
export const READ_DATABASE_PROBE = sql`SELECT 1`
