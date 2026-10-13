import { sql } from "@modules/platform/database"

/** A comment arrived: remember its time once; an answered comment is never reset. */
export const NOTE_META_COMMENT = sql`INSERT INTO public.meta_comments (connection_id, comment_id, platform, comment_at)
VALUES ($1, $2, $3, $4::timestamptz)
ON CONFLICT (connection_id, comment_id) DO NOTHING`

/** When a comment was made and whether its one private reply was taken. */
export const FIND_META_COMMENT = sql`SELECT comment_at, private_replied_at FROM public.meta_comments
WHERE connection_id = $1 AND comment_id = $2
LIMIT 1`

/** Claims the one private reply of a comment: whoever sets it from null wins; the loser gets no row back. */
export const CLAIM_PRIVATE_REPLY = sql`WITH claimed AS (
    UPDATE public.meta_comments SET private_replied_at = now()
    WHERE connection_id = $1 AND comment_id = $2 AND private_replied_at IS NULL
    RETURNING comment_id
)
SELECT comment_id FROM claimed`

/** Gives the private reply of a comment back after a send that failed. */
export const RELEASE_PRIVATE_REPLY = sql`UPDATE public.meta_comments SET private_replied_at = NULL
WHERE connection_id = $1 AND comment_id = $2`
