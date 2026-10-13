import { sql } from "@modules/platform/database"

/** Appends a line to the workspace's evidence log ($1 workspace, $2 kind, $3 actor, $4 summary, $5 lead or null, $6 evidence or null). */
export const INSERT_EVENT = sql`
    INSERT INTO public.events (workspace_id, kind, actor, summary, lead_id, evidence)
    VALUES ($1, $2, $3, $4, $5, $6)`
