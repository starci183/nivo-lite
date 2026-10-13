import { sql } from "@modules/platform/database"

/** Creates the run in the transaction that enqueues its delivery. */
export const INSERT_LEAD_ACTION = sql`INSERT INTO public.lead_actions (workspace_id, requested_by, action, input, locale)
    VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING id`

/** Reads one run of the selected workspace. */
export const FIND_LEAD_ACTION = sql`SELECT id, workspace_id, requested_by, action, input, locale, status, result, error_code
    FROM public.lead_actions WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** Begins the domain run; the platform holds the matching live job fence while every action effect runs. */
export const BEGIN_LEAD_ACTION = sql`WITH changed AS (
    UPDATE public.lead_actions SET status = 'running', job_id = $3, fencing_token = $4, updated_at = now()
    WHERE workspace_id = $1 AND id = $2 AND status IN ('queued', 'running')
    RETURNING id, workspace_id, requested_by, action, input, locale, status, result, error_code)
    SELECT * FROM changed`

/** Finishes only the domain run belonging to the worker whose fence the platform still holds. */
export const SUCCEED_LEAD_ACTION = sql`WITH changed AS (
    UPDATE public.lead_actions SET status = 'succeeded', result = $5::jsonb, error_code = NULL, updated_at = now()
    WHERE id = $1 AND workspace_id = $2 AND job_id = $3 AND fencing_token = $4 AND status = 'running' RETURNING id)
    SELECT id FROM changed`

/** Records a permanent domain refusal under the held worker fence. */
export const REFUSE_LEAD_ACTION = sql`WITH changed AS (
    UPDATE public.lead_actions SET status = 'failed', error_code = $5, updated_at = now()
    WHERE id = $1 AND workspace_id = $2 AND job_id = $3 AND fencing_token = $4 AND status = 'running' RETURNING id)
    SELECT id FROM changed`

/** Records a terminal delivery failure while the platform holds the failed worker's matching fence. */
export const FAIL_LEAD_ACTION = sql`UPDATE public.lead_actions SET status = 'failed', error_code = $3, updated_at = now()
    WHERE workspace_id = $1 AND id = $2 AND status IN ('queued', 'running')
      AND (job_id IS NULL OR (job_id = $4 AND fencing_token = $5))`
