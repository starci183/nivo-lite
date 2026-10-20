import { sql } from "@modules/platform/database"

/** Saves the kit ($1 workspace, $2 shop name, $3 main, $4 second, $5 logo, $6 music, $7 voice, $8 actor). */
export const SAVE_WORKBENCH_BRAND = sql`INSERT INTO public.video_brand_kits
(workspace_id,shop_name,primary_color,secondary_color,logo_path,music_track,voice,updated_by)
VALUES($1,$2,COALESCE($3,'#16a34a'),COALESCE($4,'#0f172a'),$5,$6,$7,$8)
ON CONFLICT(workspace_id) DO UPDATE SET shop_name=excluded.shop_name,
primary_color=COALESCE($3,video_brand_kits.primary_color),secondary_color=COALESCE($4,video_brand_kits.secondary_color),
logo_path=excluded.logo_path,music_track=excluded.music_track,voice=excluded.voice,updated_by=excluded.updated_by
RETURNING workspace_id`

/** Saves the guideline colors and name ($1 workspace, $2 main, $3 second, $4 name or empty, $5 actor). */
export const SAVE_GUIDELINE_COLORS = sql`INSERT INTO public.video_brand_kits
(workspace_id,primary_color,secondary_color,shop_name,updated_by)
VALUES($1,$2,$3,$4,$5)
ON CONFLICT(workspace_id) DO UPDATE SET primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,
shop_name=CASE WHEN excluded.shop_name='' THEN video_brand_kits.shop_name ELSE excluded.shop_name END,
updated_by=excluded.updated_by,updated_at=now()`

/** The logo path of the workspace kit ($1 workspace). */
export const SELECT_KIT_LOGO = sql`SELECT logo_path, shop_name FROM public.video_brand_kits WHERE workspace_id = $1 LIMIT 1`
