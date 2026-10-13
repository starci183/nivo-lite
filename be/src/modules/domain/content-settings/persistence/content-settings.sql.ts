import { sql } from "@modules/platform/database"

/** The next workspaces that have a content automation on, in id order ($1 one workspace or null for all, $2 the last id seen, $3 batch size). */
export const SELECT_TICK_WORKSPACES = sql`SELECT workspace_id, automations, marks
FROM public.content_settings
WHERE ($1::uuid IS NULL OR workspace_id = $1) AND workspace_id > $2
  AND ((automations ->> 'today_reminder') = 'true' OR (automations ->> 'offer_draft') = 'true' OR (automations ->> 'weekly_summary') = 'true')
ORDER BY workspace_id
LIMIT $3`

/** Merges dedupe marks into the settings of a workspace ($1 workspace, $2 marks). */
export const MERGE_MARKS = sql`UPDATE public.content_settings
SET marks = marks || $2::jsonb
WHERE workspace_id = $1`
