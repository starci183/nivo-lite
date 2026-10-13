import { sql } from "@modules/platform/database"

/** How many renders of a workspace wait or run ($1 workspace). */
export const COUNT_OPEN_RENDERS = sql`SELECT count(*)::int AS open
FROM public.video_renders
WHERE workspace_id = $1 AND status IN ('queued', 'rendering')`

/** Writes one queued render and answers its id ($1 workspace, $2 spec, $3 creator). */
export const INSERT_RENDER = sql`INSERT INTO public.video_renders (workspace_id, spec, created_by)
VALUES ($1, $2::jsonb, $3)
RETURNING id`

/** Takes one delivery of a render job: the row becomes rendering and counts the attempt; a render already done or failed answers nothing ($1 render). */
export const CLAIM_RENDER = sql`WITH claimed AS (
    UPDATE public.video_renders
    SET status = 'rendering', started_at = COALESCE(started_at, now()), error = NULL,
        meta = jsonb_set(meta, '{attempts}', to_jsonb(COALESCE((meta ->> 'attempts')::int, 0) + 1))
    WHERE id = $1 AND status IN ('queued', 'rendering')
    RETURNING id, workspace_id, spec, meta
)
SELECT id, workspace_id, spec, (meta ->> 'attempts')::int AS attempts FROM claimed`

/** Records the progress of a running render; a lower value than the one stored is ignored ($1 render, $2 percent, $3 stage). */
export const UPDATE_RENDER_PROGRESS = sql`UPDATE public.video_renders
SET status = 'rendering', progress = $2, stage = $3
WHERE id = $1 AND status IN ('queued', 'rendering') AND progress <= $2`

/** Marks a render done with its files and report ($1 render, $2 video path, $3 poster path, $4 duration ms, $5 size bytes, $6 report). */
export const COMPLETE_RENDER = sql`UPDATE public.video_renders
SET status = 'done', progress = 100, stage = NULL, output_path = $2, poster_path = $3, duration_ms = $4, size_bytes = $5,
    error = NULL, meta = meta || $6::jsonb, finished_at = now()
WHERE id = $1 AND status IN ('queued', 'rendering')`

/** Marks a render failed with the reason ($1 render, $2 reason). */
export const FAIL_RENDER = sql`UPDATE public.video_renders
SET status = 'failed', error = left($2, 300), finished_at = now()
WHERE id = $1 AND status IN ('queued', 'rendering')`
