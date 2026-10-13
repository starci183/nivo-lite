import { sql } from "@modules/platform/database"

/** Projects in the current workspace ($1 workspace, $2 optional project, $3 include archived). */
export const LIST_WORKBENCH_PROJECTS = sql`SELECT p.*, CASE WHEN r.id IS NULL THEN NULL ELSE
jsonb_build_object('id',r.id,'status',r.status,'progress',r.progress,'stage',r.stage,'duration_ms',r.duration_ms,
'size_bytes',r.size_bytes,'output_path',r.output_path,'poster_path',r.poster_path) END AS render
FROM public.video_projects p LEFT JOIN public.video_renders r ON r.id=p.render_id AND r.workspace_id=p.workspace_id
WHERE p.workspace_id=$1 AND ($2::uuid IS NULL OR p.id=$2) AND ($3::boolean OR p.status<>'archived')
ORDER BY p.updated_at DESC LIMIT 60`

/** Workspace name and optional kit ($1 workspace). */
export const READ_WORKBENCH_BRAND = sql`SELECT w.name AS workspace_name,k.shop_name,k.primary_color,k.secondary_color,k.logo_path,k.music_track,k.voice
FROM public.workspaces w LEFT JOIN public.video_brand_kits k ON k.workspace_id=w.id WHERE w.id=$1 LIMIT 1`

/** Public shared readable video sources ($1 workspace). */
export const LIST_VIDEO_SOURCES = sql`SELECT id,title,topic,left(regexp_replace(content,'\\s+',' ','g'),220) AS excerpt
FROM public.knowledge_sources WHERE workspace_id=$1 AND visibility='public'
AND status IN ('ready','extracting_facts') AND (module IS NULL OR module='video') AND installation_id IS NULL
ORDER BY created_at DESC LIMIT 40`

/** Status counts and the last month's usage ($1 workspace). */
export const READ_VIDEO_FIGURES = sql`SELECT count(*) FILTER (WHERE status='rendering')::int AS rendering,
count(*) FILTER (WHERE status='scripting')::int AS scripting,
count(*) FILTER (WHERE status IN ('ready','approved'))::int AS "readyToPublish",
count(*) FILTER (WHERE status='approved')::int AS approved,
count(*) FILTER (WHERE status='published' AND published_at >= now()-interval '30 days')::int AS "published30",
(SELECT COALESCE(sum(ceil(cost_usd / public.credit_usd_value())),0)::int FROM public.ai_usage_events WHERE workspace_id=$1 AND module='video'
AND created_at>=now()-interval '30 days') AS "credits30"
FROM public.video_projects WHERE workspace_id=$1`
