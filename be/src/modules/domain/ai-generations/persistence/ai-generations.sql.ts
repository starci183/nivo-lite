import { sql } from "@modules/platform/database"

/** Writes a queued generation and answers its id ($1 workspace, $2 purpose, $3 module, $4 usage kind, $5 input JSON). */
export const INSERT_GENERATION = sql`INSERT INTO public.ai_generations (workspace_id, purpose, module, usage_kind, input)
VALUES ($1, $2, $3, $4, $5::jsonb)
RETURNING id`

/** What a caller polls of its generation ($1 id, $2 workspace). */
export const FIND_GENERATION_PROGRESS = sql`SELECT status, output, usage, timings
FROM public.ai_generations
WHERE id = $1 AND workspace_id = $2
LIMIT 1`

/** Cancels a generation nobody waits for any more; one that already ended stays as it is ($1 id, $2 workspace, $3 finished at). */
export const CANCEL_GENERATION = sql`UPDATE public.ai_generations
SET status = 'cancelled', error = 'timeout', finished_at = $3
WHERE id = $1 AND workspace_id = $2 AND status IN ('queued', 'running')`

/** What the runner needs to run a generation ($1 id, $2 workspace). */
export const FIND_GENERATION = sql`SELECT id, workspace_id, purpose, module, usage_kind, status, input
FROM public.ai_generations
WHERE id = $1 AND workspace_id = $2
LIMIT 1`

/** Marks a queued generation as running ($1 id, $2 workspace). */
export const START_GENERATION = sql`UPDATE public.ai_generations SET status = 'running' WHERE id = $1 AND workspace_id = $2 AND status = 'queued'`

/** Writes the text of a generation that still waits for it and answers what to meter; nothing when the caller cancelled it ($1 id, $2 workspace, $3 output JSON, $4 usage JSON or null, $5 timings JSON, $6 finished at). */
export const FINISH_GENERATION = sql`WITH changed AS (UPDATE public.ai_generations
SET status = 'done', output = $3::jsonb, usage = $4::jsonb, timings = $5::jsonb, finished_at = $6
WHERE id = $1 AND workspace_id = $2 AND status IN ('queued', 'running')
RETURNING usage_kind, module)
SELECT usage_kind, module FROM changed`

/** Writes the failure of a generation that still waits for its text ($1 id, $2 workspace, $3 reason, $4 timings JSON, $5 finished at). */
export const FAIL_GENERATION = sql`UPDATE public.ai_generations
SET status = 'error', error = $3, timings = $4::jsonb, finished_at = $5
WHERE id = $1 AND workspace_id = $2 AND status IN ('queued', 'running')`

/** Durable application context and output ($1 id, $2 workspace); a transaction serializes completion of a root request. */
export const FIND_GENERATION_STATE = sql`SELECT id, workspace_id, purpose, module, usage_kind, status, input, output,
error, timings, created_at, finished_at FROM public.ai_generations
WHERE id = $1 AND workspace_id = $2 LIMIT 1`

/** Locks an existing root request while its application effect is applied ($1 id, $2 workspace). */
export const LOCK_GENERATION_STATE = sql`SELECT id, workspace_id, purpose, module, usage_kind, status, input, output,
error, timings, created_at, finished_at FROM public.ai_generations
WHERE id = $1 AND workspace_id = $2 LIMIT 1 FOR UPDATE`

/** Stores trusted application context before publishing a queued request ($1 id, $2 workspace, $3 context JSON). */
export const SET_GENERATION_CONTEXT = sql`UPDATE public.ai_generations
SET input = jsonb_set(input, '{context}', $3::jsonb, true) WHERE id = $1 AND workspace_id = $2`

/** Applies a durable domain result once; idempotent completion is serialized by the caller ($1 id, $2 workspace, $3 result JSON). */
export const RECORD_GENERATION_RESULT = sql`UPDATE public.ai_generations
SET output = coalesce(output, '{}'::jsonb) || jsonb_build_object('result', $3::jsonb)
WHERE id = $1 AND workspace_id = $2 AND status = 'done'`

/** Application validation failure after an engine answer ($1 id, $2 workspace, $3 code). */
export const RECORD_GENERATION_FAILURE = sql`UPDATE public.ai_generations
SET status = 'error', error = $3, finished_at = coalesce(finished_at, now())
WHERE id = $1 AND workspace_id = $2`

/** Serializes the guide questions of one member of one workspace for the rest of the transaction ($1 lock key). */
export const LOCK_GUIDE_ASKER = sql`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`

/** How many guide questions a member queued since an instant ($1 workspace, $2 user, $3 since). */
export const COUNT_GUIDE_ASKS = sql`SELECT count(*) AS asked FROM public.ai_generations
WHERE workspace_id = $1 AND usage_kind = 'guide' AND input -> 'context' ->> 'requestedBy' = $2 AND created_at >= $3`
