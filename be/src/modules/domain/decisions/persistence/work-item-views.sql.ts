import { sql } from "@modules/platform/database"

/** One page of the workspace's work items, newest first, keyset on (created_at, id); no status filter when `$2` is empty. */
export const LIST_WORK_ITEMS = sql`
    SELECT w.id, w.workspace_id, w.department, w.action, w.subject_type, w.subject_id, w.lead_id, w.inbound_event_id,
           w.parent_id, w.chain_id, w.depth, w.status, w.decided_path, w.reason, w.reasons, w.missing_fields, w.proposal,
           w.result, w.error, w.evidence_state, w.assigned_staff_id, w.execution_id, w.origin,
           to_json(w.created_at) #>> '{}' AS created_at, to_json(w.updated_at) #>> '{}' AS updated_at,
           to_json(w.completed_at) #>> '{}' AS completed_at, w.installation_id,
           to_json(w.created_at) #>> '{}' AS cursor_at
    FROM public.work_items w
    WHERE w.workspace_id = $1
      AND (cardinality($2::text[]) = 0 OR w.status = ANY($2::text[]))
      AND ($3::timestamptz IS NULL OR (w.created_at, w.id) < ($3::timestamptz, $4::uuid))
    ORDER BY w.created_at DESC, w.id DESC
    LIMIT $5`

/** One work item of the workspace. */
export const FIND_WORK_ITEM_VIEW = sql`
    SELECT w.id, w.workspace_id, w.department, w.action, w.subject_type, w.subject_id, w.lead_id, w.inbound_event_id,
           w.parent_id, w.chain_id, w.depth, w.status, w.decided_path, w.reason, w.reasons, w.missing_fields, w.proposal,
           w.result, w.error, w.evidence_state, w.assigned_staff_id, w.execution_id, w.origin,
           to_json(w.created_at) #>> '{}' AS created_at, to_json(w.updated_at) #>> '{}' AS updated_at,
           to_json(w.completed_at) #>> '{}' AS completed_at, w.installation_id,
           to_json(w.created_at) #>> '{}' AS cursor_at
    FROM public.work_items w
    WHERE w.workspace_id = $1 AND w.id = $2
    LIMIT 1`
