import { sql } from "@modules/platform/database"

/** Reads one project in the selected workspace ($1 workspace, $2 project). */
export const READ_SCRIPT_PROJECT = sql`SELECT p.id, p.title, p.goal, p.aspect, p.target_seconds, p.status,
p.inputs, p.script_meta, p.updated_at, r.status AS render_status, w.name AS workspace_name, k.shop_name
FROM public.video_projects p
JOIN public.workspaces w ON w.id = p.workspace_id
LEFT JOIN public.video_brand_kits k ON k.workspace_id = p.workspace_id
LEFT JOIN public.video_renders r ON r.id = p.render_id
WHERE p.workspace_id = $1 AND p.id = $2 LIMIT 1`

/** Locks the project against another script request or completion ($1 workspace, $2 project). */
export const LOCK_SCRIPT_PROJECT = sql`SELECT p.id, p.title, p.goal, p.aspect, p.target_seconds, p.status,
p.inputs, p.script_meta, p.updated_at, r.status AS render_status, w.name AS workspace_name, k.shop_name
FROM public.video_projects p
JOIN public.workspaces w ON w.id = p.workspace_id
LEFT JOIN public.video_brand_kits k ON k.workspace_id = p.workspace_id
LEFT JOIN public.video_renders r ON r.id = p.render_id
WHERE p.workspace_id = $1 AND p.id = $2 LIMIT 1 FOR UPDATE OF p`

/** Selected readable, public and shared video sources ($1 workspace, $2 selected ids). */
export const READ_SCRIPT_SOURCES = sql`SELECT title, topic, content FROM public.knowledge_sources
WHERE workspace_id = $1 AND id = ANY($2::uuid[]) AND visibility = 'public'
AND status IN ('ready', 'extracting_facts') AND (module IS NULL OR module = 'video')
AND installation_id IS NULL ORDER BY created_at LIMIT 12`

/** Approved configuration of the oldest video installation ($1 workspace). */
export const READ_SCRIPT_SETUP = sql`SELECT v.snapshot FROM public.module_installations i
JOIN public.module_context_versions v ON v.id = i.active_context_version_id AND v.workspace_id = i.workspace_id
WHERE i.workspace_id = $1 AND i.module_key = 'video' ORDER BY i.created_at LIMIT 1`

/** House authority, escalation and tone rules of video and the core agent. */
export const READ_SCRIPT_BASE = sql`SELECT title, body FROM public.nivo_knowledge
WHERE module IN ('video', 'core') AND kind IN ('authority', 'escalation', 'tone')
ORDER BY module DESC, slug LIMIT 20`
