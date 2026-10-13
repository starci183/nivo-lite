import { sql } from "@modules/platform/database"

/** One connection with its sealed credential ($1 connection id). */
export const FIND_CONNECTION_SECRET = sql`SELECT c.workspace_id, c.provider, c.status, s.ciphertext, s.webhook_secret, s.token_expires_at
FROM public.connection_secrets s
JOIN public.connections c ON c.id = s.connection_id
WHERE s.connection_id = $1
LIMIT 1`

/** Replaces the sealed credential ($1 connection id, $2 sealed text). */
export const SAVE_SECRET = sql`UPDATE public.connection_secrets
SET ciphertext = $2
WHERE connection_id = $1`

/** Replaces the sealed credential with the end of its access token and drops the refresh lease ($1 connection id, $2 sealed text, $3 expiry). */
export const SAVE_SECRET_WITH_EXPIRY = sql`UPDATE public.connection_secrets
SET ciphertext = $2, token_expires_at = $3, refresh_lock_until = NULL
WHERE connection_id = $1`

/** Takes the refresh lease when nobody holds a live one, so two callers never spend the same single-use refresh token ($1 connection id, $2 lease end, $3 now). */
export const TRY_REFRESH_LEASE = sql`WITH taken AS (
    UPDATE public.connection_secrets
    SET refresh_lock_until = $2
    WHERE connection_id = $1 AND (refresh_lock_until IS NULL OR refresh_lock_until < $3)
    RETURNING connection_id
)
SELECT connection_id FROM taken`

/** Drops the refresh lease ($1 connection id). */
export const RELEASE_REFRESH_LEASE = sql`UPDATE public.connection_secrets
SET refresh_lock_until = NULL
WHERE connection_id = $1`

/** The Zalo connections whose access token ends before the horizon, soonest first ($1 horizon). */
export const LIST_ZALO_CONNECTIONS_DUE = sql`SELECT s.connection_id
FROM public.connection_secrets s
JOIN public.connections c ON c.id = s.connection_id
WHERE c.provider = 'zalo_oa' AND c.status <> 'disconnected' AND s.token_expires_at IS NOT NULL AND s.token_expires_at < $1
ORDER BY s.token_expires_at
LIMIT 500`
