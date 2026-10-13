import { sql } from "@modules/platform/database"

/** A comment arrived: remember its time once; an answered comment is never reset. */
export const NOTE_META_COMMENT = sql`INSERT INTO public.meta_comments (connection_id, comment_id, platform, comment_at)
VALUES ($1, $2, $3, $4::timestamptz)
ON CONFLICT (connection_id, comment_id) DO NOTHING`
