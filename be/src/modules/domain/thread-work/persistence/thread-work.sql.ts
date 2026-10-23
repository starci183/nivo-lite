import { sql } from "@modules/platform/database"

/** Records a piece of thread work ($1 workspace, $2 thread, $3 work item, $4 agent); a work item is recorded once. */
export const INSERT_THREAD_WORK = sql`
    INSERT INTO public.thread_work (workspace_id, thread_id, work_item_id, agent_id)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (work_item_id) DO UPDATE SET updated_at = now()
    RETURNING id, workspace_id, thread_id, work_item_id, agent_id, state, approval_request_id, waiting_member_id, missing_fields`

/**
 * Moves a piece of thread work ($1 workspace, $2 id, $3 state, $4 approval request or null to keep the one it asked, $5 member
 * asked, $6 fields asked). The request it once asked stays named: the decision history reads the work behind a request through it.
 */
export const UPDATE_THREAD_WORK = sql`
    UPDATE public.thread_work
    SET state = $3, approval_request_id = COALESCE($4, approval_request_id), waiting_member_id = $5, missing_fields = $6,
        updated_at = now()
    WHERE workspace_id = $1 AND id = $2`

/** The thread work whose approval request was settled since it asked, oldest first ($1 limit). */
export const LIST_SETTLED_ASKS = sql`
    SELECT w.id, w.workspace_id, w.thread_id, w.work_item_id, w.agent_id, w.state, w.approval_request_id,
           w.waiting_member_id, w.missing_fields, r.status AS request_status, r.resolved_by
    FROM public.thread_work w
    JOIN public.approval_requests r ON r.id = w.approval_request_id
    WHERE w.state = 'asked' AND r.status <> 'pending'
    ORDER BY w.updated_at
    LIMIT $1`

/** The thread work of one approval request, once it was settled ($1 request). */
export const FIND_SETTLED_ASK = sql`
    SELECT w.id, w.workspace_id, w.thread_id, w.work_item_id, w.agent_id, w.state, w.approval_request_id,
           w.waiting_member_id, w.missing_fields, r.status AS request_status, r.resolved_by
    FROM public.thread_work w
    JOIN public.approval_requests r ON r.id = w.approval_request_id
    WHERE w.approval_request_id = $1 AND w.state = 'asked' AND r.status <> 'pending'
    LIMIT 1`

/** The thread work waiting for this member's answer in this thread ($1 workspace, $2 thread, $3 member). */
export const FIND_WAITING_FOR_MEMBER = sql`
    SELECT id, workspace_id, thread_id, work_item_id, agent_id, state, approval_request_id, waiting_member_id, missing_fields
    FROM public.thread_work
    WHERE workspace_id = $1 AND thread_id = $2 AND waiting_member_id = $3 AND state = 'waiting_member'
    ORDER BY updated_at
    LIMIT 1`

/** One active agent of the workspace ($1 workspace, $2 agent). */
export const FIND_WORK_AGENT = sql`
    SELECT id, name, module, can_tag_agent_ids
    FROM public.agents
    WHERE workspace_id = $1 AND id = $2 AND status = 'active'
    LIMIT 1`

/** The active agents of the workspace among the ids, in the order given ($1 workspace, $2 agent ids). */
export const LIST_WORK_AGENTS = sql`
    SELECT a.id, a.name, a.module, a.can_tag_agent_ids
    FROM public.agents a
    JOIN unnest($2::uuid[]) WITH ORDINALITY AS t(id, position) ON t.id = a.id
    WHERE a.workspace_id = $1 AND a.status = 'active'
    ORDER BY t.position
    LIMIT 50`

/** One member as a decider ($1 workspace, $2 member). */
export const FIND_DECIDER = sql`
    SELECT id, display_name, role FROM public.workspace_members WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** One customer of the workspace ($1 workspace, $2 lead). */
export const FIND_WORK_LEAD = sql`SELECT id, contact_name FROM public.leads WHERE workspace_id = $1 AND id = $2 LIMIT 1`
