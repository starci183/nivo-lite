import { sql } from "@modules/platform/database"

/**
 * One page of the Office thread, newest first, keyset on (created_at, id); `$2` null starts at the newest. `$5` null reads every
 * room (the Office room), a room key reads that room only. A card's state is read live from the decision its ref names.
 */
export const LIST_MESSAGES = sql`
    SELECT m.id, m.author_kind, m.author_name, m.agent_id, m.staff_id, m.body, m.lead_id, m.work_item_id,
           l.contact_name AS lead_name, w.department, m.room, m.card::text AS card_json,
           CASE
               WHEN m.card IS NULL THEN NULL
               WHEN m.card #>> '{ref,kind}' = 'execution' THEN COALESCE((
                   SELECT CASE x.status WHEN 'pending_approval' THEN 'pending' WHEN 'approved' THEN 'approved' ELSE 'declined' END
                   FROM public.executions x
                   WHERE x.id::text = m.card #>> '{ref,id}' AND x.workspace_id = m.workspace_id), 'info')
               WHEN m.card #>> '{ref,kind}' = 'work_item' THEN COALESCE((
                   SELECT CASE r.status WHEN 'waiting_decision' THEN 'pending' WHEN 'done' THEN 'done'
                                        WHEN 'rejected' THEN 'declined' WHEN 'failed' THEN 'failed' ELSE 'queued' END
                   FROM public.work_items r
                   WHERE r.id::text = m.card #>> '{ref,id}' AND r.workspace_id = m.workspace_id), 'info')
               ELSE 'info'
           END AS card_state,
           to_json(m.created_at) #>> '{}' AS created_at
    FROM public.messages m
    LEFT JOIN public.leads l ON l.id = m.lead_id AND l.workspace_id = m.workspace_id
    LEFT JOIN public.work_items w ON w.id = m.work_item_id AND w.workspace_id = m.workspace_id
    WHERE m.workspace_id = $1
      AND ($5::text IS NULL OR m.room = $5::text)
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
