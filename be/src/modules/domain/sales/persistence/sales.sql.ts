import { sql } from "@modules/platform/database"

/** The just-enqueued Sales action ($1 workspace, $2 queue dedupe key). */
export const FIND_ACTION_BY_KEY = sql`SELECT * FROM public.sales_action_find($1::uuid, $2, NULL) LIMIT 1`

/** One Sales action the member may poll ($1 workspace, $2 outbox id). */
export const FIND_ACTION_STATUS = sql`SELECT * FROM public.sales_action_find($1::uuid, NULL, $2::uuid) LIMIT 1`
