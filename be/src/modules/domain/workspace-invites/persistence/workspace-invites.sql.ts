import { sql } from "@modules/platform/database"

/** The invitations of a workspace that can still be accepted. */
export const LIST_PENDING_INVITES = sql`
    SELECT i.id, i.email, i.role, i.staff_id, i.created_at, i.expires_at
    FROM public.workspace_invites i
    WHERE i.workspace_id = $1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > $2
    ORDER BY i.created_at DESC
    LIMIT 200`

/** Whether a pending invitation for another address already holds a staff row. */
export const FIND_STAFF_INVITE = sql`
    SELECT i.id
    FROM public.workspace_invites i
    WHERE i.workspace_id = $1 AND i.staff_id = $2 AND i.accepted_at IS NULL AND i.revoked_at IS NULL
      AND i.expires_at > $3 AND lower(i.email) <> $4
    LIMIT 1`

/** A newer invitation replaces any pending one for the same address. */
export const REVOKE_PENDING_FOR_EMAIL = sql`
    UPDATE public.workspace_invites SET revoked_at = $3
    WHERE workspace_id = $1 AND lower(email) = $2 AND accepted_at IS NULL AND revoked_at IS NULL`

/** A new token from the database's strong random source; only its hash is ever stored. */
export const MINT_TOKEN = sql`
    SELECT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') AS token`

/** Stores an invitation by the SHA-256 hash of its token. */
export const INSERT_INVITE = sql`
    INSERT INTO public.workspace_invites (workspace_id, email, role, staff_id, token_hash, invited_by, expires_at)
    VALUES ($1, $2, $3, $4, encode(sha256(convert_to($5, 'utf8')), 'hex'), $6, $7)`

/** Replaces the token of a pending invitation (the old link stops working), extends its life and answers it. */
export const ROTATE_INVITE = sql`
    WITH changed AS (
        UPDATE public.workspace_invites
        SET token_hash = encode(sha256(convert_to($3, 'utf8')), 'hex'), expires_at = $4
        WHERE id = $1 AND workspace_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL
        RETURNING id, email, role
    )
    SELECT id, email, role FROM changed LIMIT 1`

/** Revokes a pending invitation and answers it. */
export const REVOKE_INVITE = sql`
    WITH changed AS (
        UPDATE public.workspace_invites SET revoked_at = $3
        WHERE id = $1 AND workspace_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL
        RETURNING id, email, role
    )
    SELECT id, email, role FROM changed LIMIT 1`

/** The invitation behind a token. */
export const FIND_INVITE_BY_TOKEN = sql`
    SELECT i.id, i.workspace_id, i.email, i.role, i.staff_id, i.accepted_at, i.revoked_at, i.expires_at
    FROM public.workspace_invites i
    WHERE i.token_hash = encode(sha256(convert_to($1, 'utf8')), 'hex')
    LIMIT 1`

/** What a person sees before accepting. */
export const PREVIEW_INVITE = sql`
    SELECT w.name AS workspace_name, i.email, i.role, s.name AS staff_name,
           CASE WHEN i.revoked_at IS NOT NULL THEN 'revoked'
                WHEN i.accepted_at IS NOT NULL THEN 'accepted'
                WHEN i.expires_at < $2 THEN 'expired'
                ELSE 'pending' END AS state
    FROM public.workspace_invites i
    JOIN public.workspaces w ON w.id = i.workspace_id
    LEFT JOIN public.staff s ON s.id = i.staff_id
    WHERE i.token_hash = encode(sha256(convert_to($1, 'utf8')), 'hex')
    LIMIT 1`

/** Marks a pending invitation accepted. */
export const MARK_INVITE_ACCEPTED = sql`
    UPDATE public.workspace_invites SET accepted_at = $2, accepted_by = $3
    WHERE id = $1 AND accepted_at IS NULL`
