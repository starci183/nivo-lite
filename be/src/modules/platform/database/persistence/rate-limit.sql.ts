import { sql } from "../database.sql"

/** Counts $1 atomically using database time, rolling over after $2 milliseconds; $3 is the tier's limit. */
export const RATE_LIMIT_CONSUME = sql`SELECT public.http_rate_limit_consume($1::text, $2::double precision, $3::bigint) AS allowed`
