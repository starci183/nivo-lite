import { sql } from "../database.sql"

/** Sets a session to an outside PostgreSQL read only for every transaction it opens. */
export const POSTGRES_SESSION_READ_ONLY = sql`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`
