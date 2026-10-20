import { sql } from "@modules/platform/database"

/** A new draft ($1 workspace, $2 title, $3 goal, $4 aspect, $5 seconds, $6 inputs, $7 metadata, $8 creator). */
export const CREATE_WORKBENCH_PROJECT = sql`INSERT INTO public.video_projects
(workspace_id,title,goal,aspect,target_seconds,inputs,script_meta,created_by)
VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8) RETURNING id`

/** A project AI Editor renders from a delegated script; no person created it ($1 workspace, $2 title, $3 goal, $4 aspect, $5 seconds, $6 script). */
export const CREATE_DELEGATED_PROJECT = sql`INSERT INTO public.video_projects
(workspace_id,title,goal,aspect,target_seconds,script,inputs,script_meta,created_by)
VALUES($1,$2,$3,$4,$5,$6::jsonb,'{}'::jsonb,'{"delegated":true}'::jsonb,NULL) RETURNING id`

/** Guarded field edits ($1 workspace, $2 project, $3 title, $4 goal, $5 aspect, $6 seconds, $7 inputs, $8 script). */
export const UPDATE_WORKBENCH_PROJECT = sql`WITH changed AS (UPDATE public.video_projects SET title=COALESCE(NULLIF($3,''),title),
goal=COALESCE($4,goal),aspect=COALESCE($5,aspect),target_seconds=COALESCE($6,target_seconds),
inputs=COALESCE($7::jsonb,inputs),script=COALESCE($8::jsonb,script),
status=CASE WHEN $8::jsonb IS NOT NULL AND status IN ('ready','approved','published') THEN 'draft' ELSE status END,
approved_at=CASE WHEN $8::jsonb IS NOT NULL THEN NULL ELSE approved_at END,
approved_by_name=CASE WHEN $8::jsonb IS NOT NULL THEN NULL ELSE approved_by_name END,
published_at=CASE WHEN $8::jsonb IS NOT NULL THEN NULL ELSE published_at END
WHERE workspace_id=$1 AND id=$2 AND status NOT IN ('scripting','rendering') RETURNING id) SELECT id FROM changed`

/** Copies a project into a fresh draft ($1 workspace, $2 source, $3 creator). */
export const DUPLICATE_WORKBENCH_PROJECT = sql`INSERT INTO public.video_projects
(workspace_id,title,goal,aspect,target_seconds,inputs,script,source_project_id,created_by)
SELECT workspace_id,left(title||' (copy)',120),goal,aspect,target_seconds,inputs,script,id,$3
FROM public.video_projects WHERE workspace_id=$1 AND id=$2 RETURNING id`

/** Archives or restores an idle project ($1 workspace, $2 project, $3 archived). */
export const ARCHIVE_WORKBENCH_PROJECT = sql`WITH changed AS (UPDATE public.video_projects SET status=CASE WHEN $3 THEN 'archived'
WHEN render_id IS NULL THEN 'draft' ELSE 'ready' END
WHERE workspace_id=$1 AND id=$2 AND status NOT IN ('scripting','rendering') RETURNING id) SELECT id FROM changed`

/** Owner records publication of an approved project ($1 workspace, $2 project). */
export const PUBLISH_WORKBENCH_PROJECT = sql`WITH changed AS (UPDATE public.video_projects SET status='published',published_at=now()
WHERE workspace_id=$1 AND id=$2 AND status='approved' RETURNING id) SELECT id FROM changed`

/** Approves a finished render; repeated decisions preserve the first approver ($1 workspace, $2 project, $3 render, $4 approver). */
export const APPROVE_VIDEO_PROJECT = sql`WITH changed AS (UPDATE public.video_projects p SET status='approved',approved_at=now(),approved_by_name=$4
WHERE p.workspace_id=$1 AND p.id=$2 AND p.render_id=$3 AND p.status='ready'
AND EXISTS(SELECT 1 FROM public.video_renders r WHERE r.id=p.render_id AND r.workspace_id=p.workspace_id AND r.status='done')
RETURNING p.id) SELECT id FROM changed`
