import { sql } from "@modules/platform/database"

/** One page of the Office thread, newest first, keyset on (created_at, id); `$2` null starts at the newest. */
export const LIST_MESSAGES = sql`
    SELECT m.id, m.author_kind, m.author_name, m.agent_id, m.staff_id, m.body, m.lead_id, m.work_item_id,
           l.contact_name AS lead_name, w.department,
           to_json(m.created_at) #>> '{}' AS created_at
    FROM public.messages m
    LEFT JOIN public.leads l ON l.id = m.lead_id AND l.workspace_id = m.workspace_id
    LEFT JOIN public.work_items w ON w.id = m.work_item_id AND w.workspace_id = m.workspace_id
    WHERE m.workspace_id = $1
      AND ($2::timestamptz IS NULL OR (m.created_at, m.id) < ($2::timestamptz, $3::uuid))
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT $4`

/** The executions waiting for a human decision, newest first, with the context their card shows. */
export const LIST_PENDING_APPROVALS = sql`
    SELECT x.id, x.responsibility_id, x.agent_id, x.kind, x.draft, x.status, x.decided_by, x.work_item_id,
           to_json(x.decided_at) #>> '{}' AS decided_at, to_json(x.created_at) #>> '{}' AS created_at,
           r.lead_id, r.next_action, r.owner_name, l.contact_name, l.company, l.channel,
           a.name AS agent_name, w.assigned_staff_id
    FROM public.executions x
    LEFT JOIN public.responsibilities r ON r.id = x.responsibility_id
    LEFT JOIN public.leads l ON l.id = r.lead_id
    LEFT JOIN public.agents a ON a.id = x.agent_id
    LEFT JOIN public.work_items w ON w.id = x.work_item_id
    WHERE x.workspace_id = $1 AND x.status = 'pending_approval'
    ORDER BY x.created_at DESC, x.id DESC
    LIMIT $2`

/** The most recently approved or rejected executions, newest decision first, with the same context. */
export const LIST_DECIDED_APPROVALS = sql`
    SELECT x.id, x.responsibility_id, x.agent_id, x.kind, x.draft, x.status, x.decided_by, x.work_item_id,
           to_json(x.decided_at) #>> '{}' AS decided_at, to_json(x.created_at) #>> '{}' AS created_at,
           r.lead_id, r.next_action, r.owner_name, l.contact_name, l.company, l.channel,
           a.name AS agent_name, w.assigned_staff_id
    FROM public.executions x
    LEFT JOIN public.responsibilities r ON r.id = x.responsibility_id
    LEFT JOIN public.leads l ON l.id = r.lead_id
    LEFT JOIN public.agents a ON a.id = x.agent_id
    LEFT JOIN public.work_items w ON w.id = x.work_item_id
    WHERE x.workspace_id = $1 AND x.status IN ('approved', 'rejected')
    ORDER BY x.decided_at DESC NULLS LAST, x.id DESC
    LIMIT $2`
