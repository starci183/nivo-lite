import { sql } from "@modules/platform/database"

/** How many codes a workspace issued since an instant ($1 workspace, $2 since). */
export const COUNT_WORKSPACE_CODES = sql`SELECT count(*)::int AS total
FROM public.loyalty_otps
WHERE workspace_id = $1 AND created_at >= $2::timestamptz`

/** How many codes a customer was issued since an instant ($1 customer, $2 since). */
export const COUNT_CUSTOMER_CODES = sql`SELECT count(*)::int AS total
FROM public.loyalty_otps
WHERE customer_id = $1 AND created_at >= $2::timestamptz`

/** Stores the hash of a code and answers its id ($1 workspace, $2 customer, $3 hash, $4 expires). */
export const INSERT_CODE = sql`INSERT INTO public.loyalty_otps (workspace_id, customer_id, code_hash, expires_at)
VALUES ($1, $2, $3, $4::timestamptz)
RETURNING id`

/** Drops a code that could not be delivered ($1 code). */
export const DELETE_CODE = sql`DELETE FROM public.loyalty_otps
WHERE id = $1`

/** The newest code of a customer that is unused and not expired ($1 customer, $2 now). */
export const SELECT_OPEN_CODE = sql`SELECT id, code_hash, attempts
FROM public.loyalty_otps
WHERE customer_id = $1 AND used_at IS NULL AND expires_at > $2::timestamptz
ORDER BY created_at DESC
LIMIT 1`

/** Counts a wrong try ($1 code). */
export const BUMP_ATTEMPTS = sql`UPDATE public.loyalty_otps
SET attempts = attempts + 1
WHERE id = $1`

/** Marks a code used ($1 code, $2 now). */
export const MARK_USED = sql`UPDATE public.loyalty_otps
SET used_at = $2::timestamptz
WHERE id = $1`
