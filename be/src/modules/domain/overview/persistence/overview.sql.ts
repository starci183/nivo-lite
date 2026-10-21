import { sql } from "@modules/platform/database"

/** Every responsibility with its lead, due soonest first ($1 workspace). The answer is one jsonb array in `rows`. */
export const DASHBOARD_RESPONSIBILITIES = sql`SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'leadId', r.lead_id, 'title', r.title, 'ownerKind', r.owner_kind, 'ownerAgentId', r.owner_agent_id,
    'ownerName', r.owner_name, 'nextAction', r.next_action, 'dueAt', r.due_at, 'status', r.status, 'createdAt', r.created_at,
    'lead', jsonb_build_object('id', l.id, 'contactName', l.contact_name, 'company', l.company, 'stage', l.stage)
) ORDER BY r.due_at ASC NULLS LAST), '[]'::jsonb) AS rows
FROM (SELECT * FROM public.responsibilities WHERE workspace_id = $1::uuid ORDER BY due_at ASC NULLS LAST LIMIT 2000) r
JOIN public.leads l ON l.id = r.lead_id`

/** The agents, oldest first ($1 workspace). */
export const DASHBOARD_AGENTS = sql`SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'module', a.module, 'name', a.name, 'handle', a.handle, 'role', a.role, 'instructions', a.instructions,
    'knowledge', a.knowledge, 'greeting', a.greeting, 'approvalRule', a.approval_rule, 'status', a.status, 'createdAt', a.created_at
) ORDER BY a.created_at), '[]'::jsonb) AS rows
FROM (SELECT * FROM public.agents WHERE workspace_id = $1::uuid ORDER BY created_at LIMIT 200) a`

/** The newest evidence lines, newest first ($1 workspace, $2 how many). */
export const DASHBOARD_EVENTS = sql`SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'leadId', e.lead_id, 'kind', e.kind, 'actor', e.actor, 'summary', e.summary, 'evidence', e.evidence, 'createdAt', e.created_at
) ORDER BY e.created_at DESC), '[]'::jsonb) AS rows
FROM (SELECT * FROM public.events WHERE workspace_id = $1::uuid ORDER BY created_at DESC LIMIT $2::int) e`

/** The leads the overview figures count ($1 workspace). */
export const DASHBOARD_LEADS = sql`SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'stage', l.stage, 'createdAt', l.created_at, 'contactName', l.contact_name, 'company', l.company
)), '[]'::jsonb) AS rows
FROM (SELECT * FROM public.leads WHERE workspace_id = $1::uuid LIMIT 10000) l`

/** The drafts waiting for a decision with the lead behind each, newest first ($1 workspace). */
export const DASHBOARD_PENDING = sql`SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'responsibilityId', x.responsibility_id, 'createdAt', x.created_at,
    'leadId', (SELECT r.lead_id FROM public.responsibilities r WHERE r.id = x.responsibility_id)
) ORDER BY x.created_at DESC), '[]'::jsonb) AS rows
FROM (SELECT * FROM public.executions WHERE workspace_id = $1::uuid AND status = 'pending_approval' LIMIT 2000) x`

/** The facts behind the onboarding checklist and the website lead stats ($1 workspace, $2 founding from, $3 founding to). */
export const DASHBOARD_PROMO = sql`WITH website AS (
    SELECT l.id, l.created_at FROM public.leads l WHERE l.workspace_id = $1::uuid AND l.channel ILIKE '%website%'
), approved AS (
    SELECT x.responsibility_id FROM public.executions x WHERE x.workspace_id = $1::uuid AND x.status = 'approved'
)
SELECT jsonb_build_object(
    'chatbot', (SELECT jsonb_build_object('id', a.id, 'knowledge', a.knowledge) FROM public.agents a
                WHERE a.workspace_id = $1::uuid AND a.module = 'chatbot' ORDER BY a.created_at LIMIT 1),
    'isFoundingMember', EXISTS (SELECT 1 FROM public.events e WHERE e.workspace_id = $1::uuid AND e.kind = 'module.purchased'
                                AND e.created_at >= $2::timestamptz AND e.created_at <= $3::timestamptz),
    'websiteLeads', coalesce((SELECT jsonb_agg(jsonb_build_object('id', w.id, 'createdAt', w.created_at)) FROM website w), '[]'::jsonb),
    'firstEvents', coalesce((SELECT jsonb_agg(jsonb_build_object('leadId', e.lead_id, 'at', e.first_at))
                             FROM (SELECT lead_id, min(created_at) AS first_at FROM public.events
                                   WHERE workspace_id = $1::uuid AND kind IN ('execution.approved', 'responsibility.assigned')
                                     AND lead_id IN (SELECT id FROM website) GROUP BY lead_id) e), '[]'::jsonb),
    'hasCustomerConversation', EXISTS (SELECT 1 FROM public.agent_conversations c WHERE c.workspace_id = $1::uuid AND c.kind = 'customer'),
    'hasLeadConversation', EXISTS (SELECT 1 FROM public.agent_conversations c WHERE c.workspace_id = $1::uuid AND c.lead_id IS NOT NULL),
    'approvedCount', (SELECT count(*)::int FROM approved),
    'hasWon', EXISTS (SELECT 1 FROM public.events e WHERE e.workspace_id = $1::uuid AND e.kind = 'outcome.recorded'
                      AND e.lead_id IN (SELECT id FROM public.leads WHERE workspace_id = $1::uuid AND stage = 'won')),
    'invoiceApproved', EXISTS (SELECT 1 FROM public.responsibilities r WHERE r.workspace_id = $1::uuid
                               AND (r.title ILIKE 'Prepare invoice%' OR r.title ILIKE 'Chu' || chr(7849) || 'n b' || chr(7883) || ' h' || chr(243) || 'a ' || chr(273) || chr(417) || 'n%')
                               AND r.id IN (SELECT responsibility_id FROM approved))
) AS promo`

/** The rows behind the governance figures ($1 workspace, $2 start of the 7-day window). */
export const DASHBOARD_GOVERNANCE = sql`SELECT jsonb_build_object(
    'authority', (SELECT jsonb_build_object('goalRevenueVnd', a.goal_revenue_vnd, 'goalNewCustomers', a.goal_new_customers,
                                            'goalFirstReplyMinutes', a.goal_first_reply_minutes)
                  FROM public.authority a WHERE a.workspace_id = $1::uuid),
    'leads', coalesce((SELECT jsonb_agg(jsonb_build_object('id', l.id, 'contactName', l.contact_name, 'company', l.company,
                                                           'stage', l.stage, 'createdAt', l.created_at))
                       FROM (SELECT * FROM public.leads WHERE workspace_id = $1::uuid LIMIT 10000) l), '[]'::jsonb),
    'orders', coalesce((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'leadId', o.lead_id, 'orderNo', o.order_no, 'items', o.items,
                                                            'amountVnd', o.amount_vnd, 'status', o.status))
                        FROM public.orders o WHERE o.workspace_id = $1::uuid AND o.status IN ('confirmed', 'invoiced', 'paid')), '[]'::jsonb),
    'invoices', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'orderId', i.order_id, 'leadId', i.lead_id, 'invoiceNo', i.invoice_no,
                                                              'amountVnd', i.amount_vnd, 'status', i.status))
                          FROM public.invoices i WHERE i.workspace_id = $1::uuid AND i.status IN ('issued', 'paid')), '[]'::jsonb),
    'transactions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'invoiceId', t.invoice_id, 'payer', t.payer, 'reference', t.reference,
                                                                  'amountVnd', t.amount_vnd, 'status', t.status))
                              FROM public.transactions t WHERE t.workspace_id = $1::uuid AND t.direction = 'credit'
                                AND t.status IN ('matched', 'unmatched', 'needs_review')), '[]'::jsonb),
    'work', coalesce((SELECT jsonb_agg(jsonb_build_object('id', w.id, 'leadId', w.lead_id, 'department', w.department, 'status', w.status,
                                                          'reason', w.reason, 'decidedPath', w.decided_path, 'createdAt', w.created_at,
                                                          'updatedAt', w.updated_at, 'completedAt', w.completed_at,
                                                          'summary', w.proposal ->> 'summary',
                                                          'contact', w.proposal -> 'fields' ->> 'contact_name',
                                                          'customer', w.proposal -> 'fields' ->> 'customer') ORDER BY w.created_at DESC)
                      FROM (SELECT * FROM public.work_items WHERE workspace_id = $1::uuid ORDER BY created_at DESC LIMIT 2000) w), '[]'::jsonb),
    'pendingWithoutWork', (SELECT count(*)::int FROM public.executions x
                           WHERE x.workspace_id = $1::uuid AND x.status = 'pending_approval' AND x.work_item_id IS NULL),
    'decisions7', coalesce((SELECT jsonb_agg(jsonb_build_object('workItemId', d.work_item_id, 'leadId', d.lead_id, 'deciderKind', d.decider_kind,
                                                                'outcome', d.outcome, 'createdAt', d.created_at))
                            FROM public.decisions d WHERE d.workspace_id = $1::uuid AND d.created_at >= $2::timestamptz), '[]'::jsonb),
    'recent', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'workItemId', d.work_item_id, 'leadId', d.lead_id,
                                                            'leadName', (SELECT l.contact_name FROM public.leads l WHERE l.id = d.lead_id),
                                                            'department', d.department, 'action', d.action, 'decidedBy', d.decided_by,
                                                            'deciderKind', d.decider_kind, 'outcome', d.outcome, 'reason', d.reason,
                                                            'note', d.note, 'createdAt', d.created_at) ORDER BY d.created_at DESC)
                        FROM (SELECT * FROM public.decisions WHERE workspace_id = $1::uuid ORDER BY created_at DESC LIMIT 40) d), '[]'::jsonb)
) AS governance`

/** The work items waiting for a decision or failed, with their lead and assigned staff ($1 workspace). */
export const DASHBOARD_EXCEPTIONS = sql`SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id, 'leadId', w.lead_id, 'department', w.department, 'action', w.action, 'status', w.status, 'reason', w.reason,
    'error', w.error, 'executionId', w.execution_id, 'createdAt', w.created_at,
    'assignedStaffName', (SELECT s.name FROM public.staff s WHERE s.id = w.assigned_staff_id),
    'summary', w.proposal ->> 'summary', 'contact', w.proposal -> 'fields' ->> 'contact_name', 'customer', w.proposal -> 'fields' ->> 'customer',
    'lead', (SELECT jsonb_build_object('id', l.id, 'contactName', l.contact_name, 'company', l.company, 'channel', l.channel)
             FROM public.leads l WHERE l.id = w.lead_id)
) ORDER BY w.created_at), '[]'::jsonb) AS rows
FROM (SELECT * FROM public.work_items WHERE workspace_id = $1::uuid AND status IN ('waiting_decision', 'failed')
      ORDER BY created_at LIMIT 100) w`
