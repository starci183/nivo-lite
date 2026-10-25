import { sql } from "@modules/platform/database"

/**
 * Claims a delivery in one statement ($1 kind, $2 job key, $3 worker, $4 lease end, $5 payload, $6 instant). A new key inserts the row
 * with token 1; an existing key is claimed again only when the job failed or its lease expired, and then the token is bumped by the
 * store. A done job and a live claim match nothing, so no row comes back.
 */
export const CLAIM_JOB = sql`INSERT INTO public.jobs (kind, job_key, status, fencing_token, claimed_by, lease_expires_at, payload, created_at, updated_at)
    VALUES ($1, $2, 'running', 1, $3, $4, $5::jsonb, $6, $6)
    ON CONFLICT (job_key) DO UPDATE
       SET fencing_token = jobs.fencing_token + 1, claimed_by = $3, lease_expires_at = $4, status = 'running', error = NULL, updated_at = $6
     WHERE jobs.status = 'failed' OR (jobs.status = 'running' AND jobs.lease_expires_at < $6)
    RETURNING id, kind, fencing_token, current_step, payload`

/** Distinguishes idempotent completion from a refused live claim without retaining a transaction while the broker waits. */
export const JOB_CLAIM_STATE = sql`SELECT status, lease_expires_at FROM public.jobs WHERE job_key = $1 LIMIT 1`

/** The guarded writes wrap their UPDATE in a CTE: TypeORM returns a bare `UPDATE ... RETURNING` as `[rows, count]`, a SELECT as rows. */

/** Records a step ($1 job id, $2 expected token, $3 step, $4 instant); no row comes back when the token is stale. */
export const ADVANCE_JOB = sql`WITH changed AS (UPDATE public.jobs SET current_step = $3, updated_at = $4
    WHERE id = $1 AND fencing_token = $2 AND status = 'running'
       RETURNING id)
    SELECT id FROM changed`

/** Completes the job ($1 job id, $2 expected token, $3 instant). */
export const COMPLETE_JOB = sql`WITH changed AS (UPDATE public.jobs SET status = 'done', lease_expires_at = NULL, updated_at = $3
    WHERE id = $1 AND fencing_token = $2 AND status = 'running'
       RETURNING id)
    SELECT id FROM changed`

/** Fails the job ($1 job id, $2 expected token, $3 reason, $4 instant). */
export const FAIL_JOB = sql`WITH changed AS (UPDATE public.jobs SET status = 'failed', error = $3, lease_expires_at = NULL, updated_at = $4
    WHERE id = $1 AND fencing_token = $2 AND status = 'running'
       RETURNING id)
    SELECT id FROM changed`

/** Locks the live job fence while its domain effects run; a replacement claim waits until the effects and progress are recorded. */
export const LOCK_JOB_FENCE = sql`SELECT id FROM public.jobs WHERE id = $1 AND fencing_token = $2 AND status = 'running' LIMIT 1 FOR UPDATE`
/** Locks a delivery only when its latest claim failed; a successor claim makes this return no row. */
export const LOCK_FAILED_JOB_FENCE = sql`SELECT id, fencing_token FROM public.jobs
    WHERE job_key = $1 AND status = 'failed' LIMIT 1 FOR UPDATE`
