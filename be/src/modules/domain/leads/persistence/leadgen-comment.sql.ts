import { sql } from "@modules/platform/database"

/** Reads only the decision job for this workspace and exact work-item dedupe identity. */
export const FIND_LEADGEN_COMMENT_JOB = sql`
    SELECT state FROM public.job_status($1::uuid, $2::text, $3::text, $4::text) LIMIT 1`
