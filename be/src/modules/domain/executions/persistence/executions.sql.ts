import { sql } from "@modules/platform/database"

/** Creates the approval card of a draft and answers its id ($1 workspace, $2 responsibility, $3 agent or null, $4 draft, $5 work item). */
export const INSERT_EXECUTION = sql`
    INSERT INTO public.executions (workspace_id, responsibility_id, agent_id, draft, work_item_id)
    VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid)
    RETURNING id`
