import { sql } from "@modules/platform/database"

/** Appends a line to the workspace's evidence log. */
export const INSERT_EVENT = sql`
    INSERT INTO public.events (workspace_id, kind, actor, summary)
    VALUES ($1, $2, $3, $4)`
