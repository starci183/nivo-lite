import { sql } from "@modules/platform/database"

/** The live sessions of an Auth user, most recently active first ($1 user). */
export const LIST_SESSIONS = sql`
    SELECT id, created_at, last_active_at, user_agent, ip FROM public.be_account_sessions($1) LIMIT 100`

/** The identity providers linked to an Auth user ($1 user). */
export const LIST_PROVIDERS = sql`SELECT provider FROM public.be_account_providers($1) LIMIT 20`

/** Deletes one session of an Auth user ($1 user, $2 session). */
export const REVOKE_SESSION = sql`SELECT public.be_revoke_session($1, $2) AS revoked`
