import { sql } from "@modules/platform/database"

/** Creates the approval card of a draft and answers its id ($1 workspace, $2 responsibility, $3 agent or null, $4 draft, $5 work item). */
export const INSERT_EXECUTION = sql`
    INSERT INTO public.executions (workspace_id, responsibility_id, agent_id, draft, work_item_id)
    VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid)
    RETURNING id`

/** One approval card of the workspace ($1 workspace, $2 execution). */
export const FIND_EXECUTION = sql`
    SELECT x.id, x.status, x.work_item_id, x.draft
    FROM public.executions x
    WHERE x.workspace_id = $1::uuid AND x.id = $2::uuid
    LIMIT 1`

/** Settles a card that still waits and answers it; no row when it was decided already ($1 workspace, $2 execution, $3 status, $4 decider, $5 edited draft or null, $6 decision time). */
export const SETTLE_EXECUTION = sql`
    WITH changed AS (
        UPDATE public.executions
        SET status = $3, decided_by = $4, decided_at = $6::timestamptz, draft = COALESCE($5, draft)
        WHERE workspace_id = $1::uuid AND id = $2::uuid AND status = 'pending_approval'
        RETURNING id, status, work_item_id, draft
    )
    SELECT id, status, work_item_id, draft FROM changed`
