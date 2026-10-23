import { sql } from "@modules/platform/database"

/** Workspace decision history, optionally one lead or one department's human decisions ($1 workspace, $2 lead, $3 human department, $4 oldest first, $5 limit). */
export const LIST_LEAD_DECISION_HISTORY = sql`
    SELECT d.id, d.work_item_id, d.lead_id, l.contact_name AS "leadName", d.department, d.action,
           COALESCE(m.display_name, d.decided_by) AS decided_by, d.decided_by_member_id AS "decidedByMemberId",
           d.decider_kind, d.outcome, d.reason, d.note,
           to_json(d.created_at) #>> '{}' AS created_at
    FROM public.decisions d
    LEFT JOIN public.leads l ON l.id = d.lead_id AND l.workspace_id = d.workspace_id
    LEFT JOIN public.workspace_members m ON m.id = d.decided_by_member_id
    WHERE d.workspace_id = $1::uuid AND ($2::uuid IS NULL OR d.lead_id = $2::uuid)
      AND ($3::text IS NULL OR (d.department = $3 AND d.decider_kind IN ('owner', 'staff')))
    ORDER BY CASE WHEN $4::boolean THEN d.created_at END ASC,
             CASE WHEN NOT $4::boolean THEN d.created_at END DESC, d.id ASC
    LIMIT $5::int`

/**
 * The newest lines of the decision history with the customer name: the decision log of the work engine, the approval requests the
 * engine does not log (verdicts given on a thread card outside an agent's work, and every request that ran out of time), and the
 * tasks a member completed after being tagged in a thread no agent's work runs in. A null filter ($2 kinds, $3 outcome, $4 module)
 * does not narrow ($1 workspace, $5 limit).
 */
export const LIST_DECISION_HISTORY = sql`
    WITH lines AS (
        SELECT d.id, d.work_item_id, d.lead_id, d.department, d.action,
               COALESCE(m.display_name, d.decided_by) AS decided_by, d.decided_by_member_id, d.decider_kind, d.outcome,
               d.reason, COALESCE(d.note, '') AS note, d.created_at
        FROM public.decisions d
        LEFT JOIN public.workspace_members m ON m.id = d.decided_by_member_id
        WHERE d.workspace_id = $1
        UNION ALL
        SELECT r.id, NULL::uuid, t.lead_id, r.department, r.action, COALESCE(m.display_name, 'NIVO'), r.resolved_by,
               CASE WHEN m.id IS NULL THEN 'policy' WHEN m.role = 'owner' THEN 'owner' ELSE 'staff' END,
               r.status, 'over_authority', COALESCE(ar.note, ''), COALESCE(r.resolved_at, r.created_at)
        FROM public.approval_requests r
        LEFT JOIN public.workspace_members m ON m.id = r.resolved_by
        LEFT JOIN public.work_chains c ON c.id = r.chain_step_id
        LEFT JOIN public.work_threads t ON t.id = c.thread_id
        LEFT JOIN public.authority_rules ar ON ar.workspace_id = r.workspace_id AND ar.action = r.action
        WHERE r.workspace_id = $1 AND r.status <> 'pending'
          AND (r.status = 'expired' OR NOT EXISTS (SELECT 1 FROM public.thread_work w WHERE w.approval_request_id = r.id))
        UNION ALL
        SELECT c.id, NULL::uuid, t.lead_id, COALESCE(a.module, 'office'), 'thread_task', m.display_name, c.decided_by,
               CASE WHEN m.role = 'owner' THEN 'owner' ELSE 'staff' END, 'completed', NULL::text, COALESCE(c.rule, c.action),
               COALESCE(c.finished_at, c.started_at)
        FROM public.work_chains c
        JOIN public.workspace_members m ON m.id = c.decided_by
        JOIN public.work_threads t ON t.id = c.thread_id
        LEFT JOIN public.agents a ON a.id = c.actor_id AND c.actor_kind = 'agent'
        WHERE c.workspace_id = $1 AND c.kind IN ('hand_off', 'assign') AND c.status = 'done'
          AND NOT EXISTS (SELECT 1 FROM public.thread_work w WHERE w.thread_id = c.thread_id)
    )
    SELECT l.id, l.work_item_id, l.lead_id, ld.contact_name AS "leadName", l.department, l.action, l.decided_by,
           l.decided_by_member_id AS "decidedByMemberId", l.decider_kind, l.outcome, l.reason, l.note,
           to_json(l.created_at) #>> '{}' AS created_at
    FROM lines l
    LEFT JOIN public.leads ld ON ld.id = l.lead_id
    WHERE ($2::text[] IS NULL OR l.decider_kind = ANY($2::text[]))
      AND ($3::text IS NULL OR l.outcome = $3::text)
      AND ($4::text IS NULL OR l.department = $4::text)
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT $5`
