import { sql } from "@modules/platform/database"

/**
 * The project a caller asks to render, locked for the transaction, with the caller's role in its workspace, the workspace name, the brand kit and the
 * status of the render it points at ($1 project, $2 caller). No row = the project does not exist or the caller is not a member.
 */
export const SELECT_PROJECT_FOR_RENDER = sql`SELECT p.id, p.workspace_id, p.aspect, p.status, p.script, p.version, m.role,
       r.status AS render_status, w.name AS workspace_name,
       k.shop_name, k.primary_color, k.secondary_color, k.logo_path, k.music_track, k.voice
FROM public.video_projects p
JOIN public.workspace_members m ON m.workspace_id = p.workspace_id AND m.user_id = $2 AND m.status = 'active'
JOIN public.workspaces w ON w.id = p.workspace_id
LEFT JOIN public.video_brand_kits k ON k.workspace_id = p.workspace_id
LEFT JOIN public.video_renders r ON r.id = p.render_id
WHERE p.id = $1
LIMIT 1
FOR UPDATE OF p`

/** Points the project at its new render and opens its next version; an earlier approval no longer holds ($1 project, $2 render, $3 spec). */
export const MARK_PROJECT_RENDERING = sql`UPDATE public.video_projects
SET status = 'rendering', render_id = $2, render_ids = array_append(render_ids, $2::uuid), current_spec = $3::jsonb,
    version = version + 1, last_error = NULL, approved_at = NULL, approved_by_name = NULL, published_at = NULL
WHERE id = $1`

/** A finished render makes its project ready to approve ($1 render). */
export const READY_PROJECT = sql`UPDATE public.video_projects
SET status = 'ready', last_error = NULL
WHERE render_id = $1 AND status = 'rendering'`

/** A failed render sends its project back to draft with the reason for the owner ($1 render, $2 reason). */
export const DRAFT_PROJECT = sql`UPDATE public.video_projects
SET status = 'draft', last_error = $2
WHERE render_id = $1 AND status = 'rendering'`
