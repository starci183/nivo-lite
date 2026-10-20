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

/** Writes the confirmed guideline brand ($1 workspace, $2 colors json, $3 fonts, $4 tone, $5 imagery, $6 source, $7 voice, $8 avoid). */
export const SAVE_GUIDELINE_BRAND = sql`INSERT INTO public.content_settings
(workspace_id, brand_colors, brand_fonts, brand_tone, brand_imagery, brand_source, brand_voice, avoid)
VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8)
ON CONFLICT (workspace_id) DO UPDATE SET brand_colors = excluded.brand_colors, brand_fonts = excluded.brand_fonts,
brand_tone = excluded.brand_tone, brand_imagery = excluded.brand_imagery, brand_source = excluded.brand_source,
brand_voice = excluded.brand_voice, avoid = excluded.avoid`

/** The guideline brand of one workspace ($1 workspace). */
export const SELECT_GUIDELINE_BRAND = sql`SELECT brand_colors, brand_fonts, brand_tone, brand_imagery, avoid
FROM public.content_settings
WHERE workspace_id = $1
LIMIT 1`
