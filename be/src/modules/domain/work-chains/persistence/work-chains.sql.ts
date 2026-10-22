import { sql } from "@modules/platform/database"

/** Locks the workspace's thread while a step of its chain is written ($1 workspace, $2 thread). */
export const LOCK_CHAIN_THREAD = sql`SELECT id, lead_id
FROM public.work_threads
WHERE workspace_id = $1::uuid AND id = $2::uuid
LIMIT 1
FOR UPDATE`

/** The steps of a thread's chain with the name of whoever acted, first to last ($1 workspace, $2 thread). */
export const LIST_CHAIN_STEPS = sql`SELECT s.id, s.seq, s.actor_kind, s.actor_id,
       coalesce(a.name, m.display_name, '') AS actor_name, coalesce(a.module, m.role, '') AS actor_role,
       s.kind, s.action, s.detail, s.rule, s.target, s.approval_request_id, s.status, s.decided_by,
       to_json(s.started_at) #>> '{}' AS started_at, to_json(s.finished_at) #>> '{}' AS finished_at
FROM public.work_chains s
LEFT JOIN public.agents a ON s.actor_kind = 'agent' AND a.id = s.actor_id
LEFT JOIN public.workspace_members m ON s.actor_kind = 'member' AND m.id = s.actor_id AND m.workspace_id = s.workspace_id
WHERE s.workspace_id = $1::uuid AND s.thread_id = $2::uuid
ORDER BY s.seq ASC
LIMIT 500`

/** One step with the name of whoever acted ($1 workspace, $2 step). */
export const FIND_CHAIN_STEP = sql`SELECT s.id, s.seq, s.actor_kind, s.actor_id,
       coalesce(a.name, m.display_name, '') AS actor_name, coalesce(a.module, m.role, '') AS actor_role,
       s.kind, s.action, s.detail, s.rule, s.target, s.approval_request_id, s.status, s.decided_by,
       to_json(s.started_at) #>> '{}' AS started_at, to_json(s.finished_at) #>> '{}' AS finished_at
FROM public.work_chains s
LEFT JOIN public.agents a ON s.actor_kind = 'agent' AND a.id = s.actor_id
LEFT JOIN public.workspace_members m ON s.actor_kind = 'member' AND m.id = s.actor_id AND m.workspace_id = s.workspace_id
WHERE s.workspace_id = $1::uuid AND s.id = $2::uuid
LIMIT 1`

/**
 * Appends a step at the end of the chain; a step that waits has no end yet, any other ends now
 * ($1 workspace, $2 thread, $3 actor kind, $4 actor id, $5 kind, $6 action, $7 detail, $8 rule or null, $9 target JSON or null,
 * $10 approval request or null, $11 status).
 */
export const INSERT_CHAIN_STEP = sql`INSERT INTO public.work_chains
    (workspace_id, thread_id, seq, actor_kind, actor_id, kind, action, detail, rule, target, approval_request_id, status, finished_at)
VALUES ($1::uuid, $2::uuid, (SELECT coalesce(max(seq), 0) + 1 FROM public.work_chains WHERE thread_id = $2::uuid),
        $3, $4::uuid, $5, $6, $7, $8, $9::jsonb, $10::uuid, $11, CASE WHEN $11 = 'waiting' THEN NULL ELSE now() END)
RETURNING id`

/** The person or agent a hand-off or assignment waited on answered: those steps are done ($1 workspace, $2 thread, $3 kind, $4 id). */
export const SETTLE_TARGETED_STEPS = sql`UPDATE public.work_chains
SET status = 'done', finished_at = now()
WHERE workspace_id = $1::uuid AND thread_id = $2::uuid AND status = 'waiting' AND kind IN ('hand_off', 'assign')
  AND target ->> 'kind' = $3 AND target ->> 'id' = $4`

/** Settles the approval step of a request and answers what its evidence line needs ($1 workspace, $2 request, $3 status, $4 deciding member or null). */
export const SETTLE_APPROVAL_STEP = sql`WITH changed AS (UPDATE public.work_chains s
SET status = $3, decided_by = $4::uuid, finished_at = now()
WHERE s.workspace_id = $1::uuid AND s.approval_request_id = $2::uuid AND s.kind = 'ask_approval' AND s.status = 'waiting'
RETURNING s.thread_id, s.action)
SELECT c.thread_id, c.action, (SELECT t.lead_id FROM public.work_threads t WHERE t.id = c.thread_id LIMIT 1) AS lead_id FROM changed c`

/** The ids among the given ones that are active members of the workspace ($1 workspace, $2 member ids). */
export const FIND_ACTIVE_MEMBER_IDS = sql`SELECT id
FROM public.workspace_members
WHERE workspace_id = $1::uuid AND status = 'active' AND id = ANY($2::uuid[])
LIMIT 10`

/** The member id of the workspace's owner ($1 workspace). */
export const FIND_WORKSPACE_OWNER = sql`SELECT m.id
FROM public.workspace_members m
JOIN public.workspaces w ON w.id = m.workspace_id AND w.owner_id = m.user_id
WHERE m.workspace_id = $1::uuid
LIMIT 1`

/** The display name of an agent or member of the workspace ($1 workspace, $2 kind, $3 id). */
export const FIND_ACTOR_NAME = sql`SELECT coalesce(
    (SELECT a.name FROM public.agents a WHERE $2 = 'agent' AND a.workspace_id = $1::uuid AND a.id = $3::uuid),
    (SELECT m.display_name FROM public.workspace_members m WHERE $2 = 'member' AND m.workspace_id = $1::uuid AND m.id = $3::uuid),
    ''
) AS name`

/** The request the approval step waits on, once the gate opened it ($1 workspace, $2 step, $3 request). */
export const LINK_APPROVAL_STEP = sql`UPDATE public.work_chains
SET approval_request_id = $3::uuid
WHERE workspace_id = $1::uuid AND id = $2::uuid AND kind = 'ask_approval' AND status = 'waiting'`

/** A waiting step whose request could not be opened ends as stopped ($1 workspace, $2 step). */
export const ABANDON_CHAIN_STEP = sql`UPDATE public.work_chains
SET status = 'stopped', finished_at = now()
WHERE workspace_id = $1::uuid AND id = $2::uuid AND status = 'waiting'`
