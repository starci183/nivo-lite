import { sql } from "@modules/platform/database"

/** The delegation a render_script work item already made ($1 workspace, $2 work item). */
export const FIND_DELEGATION_OF_ITEM = sql`SELECT id, project_id FROM public.video_delegations
WHERE workspace_id=$1 AND work_item_id=$2 LIMIT 1`

/** The delegation row ($1 workspace, $2 work item, $3 project, $4 source module, $5 content item, $6 channels). */
export const INSERT_DELEGATION = sql`INSERT INTO public.video_delegations
(workspace_id,work_item_id,project_id,source_module,content_item_id,channels)
VALUES($1,$2,$3,$4,$5,$6::text[]) RETURNING id, project_id`

/** Links the queued render ($1 delegation, $2 render). */
export const SET_DELEGATION_RENDER = sql`UPDATE public.video_delegations SET render_id=$2, updated_at=now() WHERE id=$1`

/** The rendering delegation of a settled render, with what its cards show ($1 render). */
export const FIND_DELEGATION_OF_RENDER = sql`SELECT d.id, d.workspace_id, d.work_item_id, d.project_id, d.source_module, d.channels,
p.title, p.aspect, p.script, r.id AS render_id, r.status AS render_status, r.duration_ms, r.output_path, r.poster_path,
r.meta->>'captions_path' AS captions_path, r.meta->>'captions_lang' AS captions_lang, r.meta->>'voiceover' AS voiceover, r.error
FROM public.video_delegations d
JOIN public.video_projects p ON p.id=d.project_id AND p.workspace_id=d.workspace_id
JOIN public.video_renders r ON r.id=d.render_id AND r.workspace_id=d.workspace_id
WHERE d.render_id=$1 AND d.status='rendering' AND r.status IN ('done','failed') LIMIT 1`

/** Settles a rendering delegation once ($1 delegation, $2 status, $3 error); answers the row only to the caller that settled it. */
export const SETTLE_DELEGATION = sql`WITH changed AS (UPDATE public.video_delegations SET status=$2, error=$3, updated_at=now()
WHERE id=$1 AND status='rendering' RETURNING id, project_id) SELECT id, project_id FROM changed`

/** Keeps the posted card and its approval item ($1 delegation, $2 approval work item, $3 card). */
export const SAVE_DELEGATION_CARD = sql`UPDATE public.video_delegations SET approval_work_item_id=$2, card=$3::jsonb, updated_at=now()
WHERE id=$1`
