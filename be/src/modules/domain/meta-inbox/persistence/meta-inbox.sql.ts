import { sql } from "@modules/platform/database"

/** Claims one Meta delivery and returns its inbox identity only to the winning transaction; the platform inbox port takes this statement as its provider insert. */
export const INSERT_META_INBOX = sql`INSERT INTO public.meta_inbox (provider, delivery_id, payload)
VALUES ($1, $2, $3::jsonb)
ON CONFLICT (provider, delivery_id) DO NOTHING
RETURNING id`
