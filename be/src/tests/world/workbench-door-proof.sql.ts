import { type SqlText, sql } from "@modules/platform/database"

/** How many statements wait for a lock right now: a proof that holds one transaction open waits until another one is blocked behind it. */
export const WAITING_ON_LOCK: SqlText = sql`SELECT count(*)::int AS waiting FROM pg_locks WHERE NOT granted`
