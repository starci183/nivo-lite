import { sql } from "@modules/platform/database"

/** Checks an API key by its hash and counts this request against its minute; answers the key, or null for an unknown hash ($1 hash). */
export const AUTHENTICATE_API_KEY = sql`SELECT public.api_key_auth($1::text) AS auth
LIMIT 1`
