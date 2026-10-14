import { sql } from "@modules/platform/database"

/** Probes the primary database without reading application data. */
export const CHECK_READINESS_DATABASE = sql`SELECT 1 AS ready LIMIT 1`

/** Reads the jobs statistics through the function granted to the primary database role. */
export const CHECK_READINESS_JOBS = sql`SELECT public.job_stats() AS stats LIMIT 1`
