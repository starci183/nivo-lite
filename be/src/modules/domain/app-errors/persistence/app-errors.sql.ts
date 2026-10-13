import { sql } from "@modules/platform/database"

/**
 * Records one failure through app_errors_record ($1 scope, $2 message, $3 stack, $4 workspace or null, $5 connection or null,
 * $6 context): the function takes the workspace of the connection when the workspace itself is not known.
 */
export const RECORD_APP_ERROR = sql`SELECT public.app_errors_record($1::text, $2::text, $3::text, $4::uuid, $5::uuid, $6::jsonb)`
