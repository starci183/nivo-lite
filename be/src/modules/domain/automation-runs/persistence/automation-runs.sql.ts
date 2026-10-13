import { sql } from "@modules/platform/database"

/** The latest runs of a workspace, optionally of one template ($1 workspace, $2 key or null, $3 limit). */
export const SELECT_RUNS = sql`SELECT r.id, r.pipeline_id, r.trigger_ref, r.status, r.steps, r.evidence, r.error, r.created_at, r.finished_at
FROM public.automation_runs r JOIN public.automation_pipelines p ON p.id = r.pipeline_id
WHERE r.workspace_id = $1 AND ($2::text IS NULL OR p.template_key = $2)
ORDER BY r.created_at DESC LIMIT $3`

/**
 * Records a trigger; an existing (pipeline, dedupe key) records nothing and answers no row
 * ($1 pipeline, $2 workspace, $3 reference, $4 dedupe key, $5 payload, $6 status, $7 attempts, $8 due at).
 */
export const INSERT_RUN = sql`INSERT INTO public.automation_runs (pipeline_id, workspace_id, trigger_ref, dedupe_key, payload, status, attempts, run_at)
VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
ON CONFLICT (pipeline_id, dedupe_key) DO NOTHING
RETURNING id, attempts`

/** The queued or failed runs of a pipeline that are due and still have attempts ($1 pipeline, $2 attempts allowed, $3 now, $4 limit). */
export const SELECT_DUE_RUNS = sql`SELECT id FROM public.automation_runs
WHERE pipeline_id = $1 AND status IN ('queued', 'failed') AND attempts < $2 AND run_at <= $3 ORDER BY run_at LIMIT $4`

/** Takes a queued or failed run: the guarded transition lets only one tick execute it ($1 run). */
export const CLAIM_RUN = sql`WITH changed AS (
    UPDATE public.automation_runs SET status = 'running', attempts = attempts + 1, error = NULL
    WHERE id = $1 AND status IN ('queued', 'failed') RETURNING id, attempts, payload
) SELECT id, attempts, payload FROM changed`

/** Ends a run with its result ($1 run, $2 status, $3 steps, $4 evidence, $5 finished at or null). */
export const FINISH_RUN = sql`WITH changed AS (
    UPDATE public.automation_runs SET status = $2, steps = $3::jsonb, evidence = $4, error = NULL, finished_at = $5 WHERE id = $1 RETURNING id
) SELECT id FROM changed`

/** Ends a run with an error and schedules its next attempt ($1 run, $2 error, $3 next try, $4 finished at or null, $5 steps). */
export const FAIL_RUN = sql`WITH changed AS (
    UPDATE public.automation_runs SET status = 'failed', error = $2, run_at = $3, finished_at = $4, steps = $5::jsonb WHERE id = $1 RETURNING id
) SELECT id FROM changed`

/** The history of a pipeline for some references; bounded ($1 pipeline, $2 references). */
export const SELECT_PRIOR_RUNS = sql`SELECT trigger_ref, status, created_at, dedupe_key FROM public.automation_runs
WHERE pipeline_id = $1 AND trigger_ref = ANY($2::text[]) LIMIT 5000`

/** The runs of a workspace that wait for a decision on one work item; bounded ($1 workspace, $2 steps fragment). */
export const SELECT_WAITING_RUNS = sql`SELECT id, pipeline_id, steps FROM public.automation_runs
WHERE workspace_id = $1 AND status = 'waiting_approval' AND steps @> $2::jsonb LIMIT 50`

/** The latest finished run of a pipeline for one reference since an instant ($1 pipeline, $2 reference, $3 since). */
export const SELECT_LATEST_DONE_RUN = sql`SELECT id, payload FROM public.automation_runs
WHERE pipeline_id = $1 AND trigger_ref = $2 AND status = 'done' AND created_at >= $3 ORDER BY created_at DESC LIMIT 1`

/** Replaces the payload of a run ($1 run, $2 payload). */
export const UPDATE_RUN_PAYLOAD = sql`WITH changed AS (
    UPDATE public.automation_runs SET payload = $2::jsonb WHERE id = $1 RETURNING id
) SELECT id FROM changed`
