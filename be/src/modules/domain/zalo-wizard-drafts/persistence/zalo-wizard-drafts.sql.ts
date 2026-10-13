import { sql } from "@modules/platform/database"

/** The keys the Zalo wizard handed over for a connection ($1 connection id). */
export const FIND_WIZARD_DRAFT = sql`SELECT app_id, app_secret, oa_secret
FROM public.zalo_wizard_drafts
WHERE connection_id = $1
LIMIT 1`

/** Removes the draft once its keys are sealed ($1 connection id). */
export const DROP_WIZARD_DRAFT = sql`DELETE FROM public.zalo_wizard_drafts
WHERE connection_id = $1`
