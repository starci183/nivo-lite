import { sql } from "@modules/platform/database"

/** The brand and automation settings of a workspace ($1). */
export const SELECT_CONFIGURATION_BRAND = sql`SELECT workspace_id, brand_voice, avoid, cta, hashtags, automations, marks
FROM public.content_settings WHERE workspace_id = $1 LIMIT 1`

/** Creates the settings row before serializing configuration writes ($1 workspace). */
export const ENSURE_CONFIGURATION = sql`INSERT INTO public.content_settings (workspace_id) VALUES ($1)
ON CONFLICT (workspace_id) DO NOTHING`

/** Serializes edits to one workspace configuration ($1). */
export const LOCK_CONFIGURATION = sql`SELECT workspace_id FROM public.content_settings WHERE workspace_id = $1 LIMIT 1 FOR UPDATE`

/** Saves brand fields without overwriting automation flags or marks ($1 workspace, $2 voice, $3 avoid, $4 CTA, $5 hashtags). */
export const SAVE_CONFIGURATION_BRAND = sql`INSERT INTO public.content_settings (workspace_id, brand_voice, avoid, cta, hashtags)
VALUES ($1, $2, $3, $4, $5::text[]) ON CONFLICT (workspace_id) DO UPDATE SET
brand_voice = EXCLUDED.brand_voice, avoid = EXCLUDED.avoid, cta = EXCLUDED.cta, hashtags = EXCLUDED.hashtags`

/** Atomically switches one automation without losing other flags ($1 workspace, $2 one flag). */
export const SET_CONFIGURATION_AUTOMATION = sql`INSERT INTO public.content_settings (workspace_id, automations)
VALUES ($1, $2::jsonb) ON CONFLICT (workspace_id) DO UPDATE SET
automations = content_settings.automations || EXCLUDED.automations`
