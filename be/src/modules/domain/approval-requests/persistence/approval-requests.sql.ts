import { sql } from "@modules/platform/database"

/**
 * Opens a request. A step has at most one pending request: when one is pending already nothing is inserted and nothing is answered
 * ($1 workspace, $2 chain step, $3 department, $4 action, $5 amount, $6 unit, $7 agent, $8 policy, $9 approvers JSON,
 * $10 excluded JSON, $11 minutes, $12 expires at).
 */
export const INSERT_REQUEST = sql`
    INSERT INTO public.approval_requests AS r (workspace_id, chain_step_id, department, action, amount, unit,
                                               requested_by_agent_id, policy, approvers, excluded, timeout_minutes, expires_at)
    VALUES ($1, $2, $3, $4, $5::numeric, $6, $7::uuid, $8, $9::jsonb, $10::jsonb, $11::integer, $12::timestamptz)
    ON CONFLICT (chain_step_id) WHERE status = 'pending' DO NOTHING
    RETURNING r.id, r.workspace_id, r.chain_step_id, r.department, r.action, r.amount::float8 AS amount, r.unit,
              r.requested_by_agent_id, r.policy, r.status, r.approvers, r.excluded, r.timeout_minutes,
              to_json(r.expires_at) #>> '{}' AS expires_at, to_json(r.reminded_at) #>> '{}' AS reminded_at, r.resolved_by,
              to_json(r.resolved_at) #>> '{}' AS resolved_at, r.escalated_to, to_json(r.created_at) #>> '{}' AS created_at`

/** The pending request of a chain step, when there is one ($1 chain step). */
export const FIND_PENDING_REQUEST = sql`
    SELECT r.id, r.workspace_id, r.chain_step_id, r.department, r.action, r.amount::float8 AS amount, r.unit,
           r.requested_by_agent_id, r.policy, r.status, r.approvers, r.excluded, r.timeout_minutes,
           to_json(r.expires_at) #>> '{}' AS expires_at, to_json(r.reminded_at) #>> '{}' AS reminded_at, r.resolved_by,
           to_json(r.resolved_at) #>> '{}' AS resolved_at, r.escalated_to, to_json(r.created_at) #>> '{}' AS created_at
    FROM public.approval_requests r
    WHERE r.chain_step_id = $1 AND r.status = 'pending'
    LIMIT 1`

/**
 * Takes the lock of one request: every verdict and every expiry starts here, so they take turns on the one row. The first to
 * hold it settles the request; the next reads it settled ($1 request).
 */
export const LOCK_REQUEST = sql`
    SELECT r.id, r.workspace_id, r.chain_step_id, r.department, r.action, r.amount::float8 AS amount, r.unit,
           r.requested_by_agent_id, r.policy, r.status, r.approvers, r.excluded, r.timeout_minutes,
           to_json(r.expires_at) #>> '{}' AS expires_at, to_json(r.reminded_at) #>> '{}' AS reminded_at, r.resolved_by,
           to_json(r.resolved_at) #>> '{}' AS resolved_at, r.escalated_to, to_json(r.created_at) #>> '{}' AS created_at
    FROM public.approval_requests r
    WHERE r.id = $1
    LIMIT 1
    FOR UPDATE`

/** The verdicts given to a request, in the order they were given ($1 request). */
export const LIST_VERDICTS = sql`
    SELECT e.value ->> 'member_id' AS member_id, e.value ->> 'verdict' AS verdict, e.value ->> 'decided_at' AS decided_at
    FROM public.approval_requests r
    CROSS JOIN LATERAL jsonb_array_elements(r.verdicts) WITH ORDINALITY AS e(value, position)
    WHERE r.id = $1
    ORDER BY e.position ASC
    LIMIT 200`

/** Appends the verdict of one member to a request that is still pending; call it holding the lock ($1 request, $2 member, $3 verdict, $4 when). */
export const INSERT_VERDICT = sql`
    UPDATE public.approval_requests
    SET verdicts = verdicts || jsonb_build_array(jsonb_build_object('member_id', $2::text, 'verdict', $3::text, 'decided_at', $4::text))
    WHERE id = $1 AND status = 'pending'`

/**
 * Settles a pending request: how it ended, who settled it (null when it expired), when, and who it went to when it expired. Changes
 * nothing when the request is not pending any more ($1 request, $2 status, $3 member, $4 when, $5 escalated to).
 */
export const RESOLVE_REQUEST = sql`
    WITH changed AS (
        UPDATE public.approval_requests
        SET status = $2, resolved_by = $3::uuid, resolved_at = $4::timestamptz, escalated_to = $5::uuid
        WHERE id = $1 AND status = 'pending'
        RETURNING id
    )
    SELECT id FROM changed`

/** Takes the pending requests that ran out of time, oldest first, skipping the ones another worker holds ($1 now, $2 how many). */
export const LOCK_DUE_REQUESTS = sql`
    SELECT r.id, r.workspace_id, r.chain_step_id, r.department, r.action, r.amount::float8 AS amount, r.unit,
           r.requested_by_agent_id, r.policy, r.status, r.approvers, r.excluded, r.timeout_minutes,
           to_json(r.expires_at) #>> '{}' AS expires_at, to_json(r.reminded_at) #>> '{}' AS reminded_at, r.resolved_by,
           to_json(r.resolved_at) #>> '{}' AS resolved_at, r.escalated_to, to_json(r.created_at) #>> '{}' AS created_at
    FROM public.approval_requests r
    WHERE r.status = 'pending' AND r.expires_at <= $1::timestamptz
    ORDER BY r.expires_at ASC, r.id ASC
    LIMIT $2::int
    FOR UPDATE SKIP LOCKED`

/**
 * Takes the pending requests that are half-way through their time and were not reminded yet, oldest first, skipping the ones
 * another worker holds ($1 now, $2 how many).
 */
export const LOCK_REMINDABLE_REQUESTS = sql`
    SELECT r.id, r.workspace_id, r.chain_step_id, r.department, r.action, r.amount::float8 AS amount, r.unit,
           r.requested_by_agent_id, r.policy, r.status, r.approvers, r.excluded, r.timeout_minutes,
           to_json(r.expires_at) #>> '{}' AS expires_at, to_json(r.reminded_at) #>> '{}' AS reminded_at, r.resolved_by,
           to_json(r.resolved_at) #>> '{}' AS resolved_at, r.escalated_to, to_json(r.created_at) #>> '{}' AS created_at
    FROM public.approval_requests r
    WHERE r.status = 'pending' AND r.reminded_at IS NULL AND r.expires_at > $1::timestamptz
      AND r.created_at + (r.timeout_minutes * interval '30 seconds') <= $1::timestamptz
    ORDER BY r.created_at ASC, r.id ASC
    LIMIT $2::int
    FOR UPDATE SKIP LOCKED`

/** Marks a request as reminded, once ($1 request, $2 when). */
export const MARK_REMINDED = sql`
    UPDATE public.approval_requests SET reminded_at = $2::timestamptz WHERE id = $1 AND reminded_at IS NULL`

/** The id of the workspace owner seat: where a request goes when nobody else can take it ($1 workspace). */
export const FIND_OWNER_SEAT = sql`SELECT public.workspace_owner_member($1) AS id`
