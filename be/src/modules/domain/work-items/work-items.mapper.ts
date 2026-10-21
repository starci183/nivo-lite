import type { Proposal, StoredProposal, WorkItem } from "./work-items.contracts"
import type { WorkItemRow } from "./persistence/work-items.rows"
import { WorkItemsError, WorkItemsErrorCode } from "./errors/work-items.error"

/** A stored proposal as the engine uses it: a legacy row may hold an empty object, so the summary and the fields get their defaults. */
export const toProposal = (stored: StoredProposal): Proposal => ({
    ...stored,
    summary: stored.summary ?? "",
    fields: stored.fields ?? {},
})

/** One work item row as the contract: timestamps as ISO strings, the proposal complete. */
export const toWorkItem = (row: WorkItemRow): WorkItem => ({
    id: row.id,
    workspace_id: row.workspace_id,
    department: row.department,
    action: row.action,
    subject_type: row.subject_type,
    subject_id: row.subject_id,
    lead_id: row.lead_id,
    inbound_event_id: row.inbound_event_id,
    parent_id: row.parent_id,
    chain_id: row.chain_id,
    depth: row.depth,
    status: row.status,
    decided_path: row.decided_path,
    reason: row.reason,
    reasons: row.reasons,
    missing_fields: row.missing_fields,
    proposal: toProposal(row.proposal),
    result: row.result,
    error: row.error,
    evidence_state: row.evidence_state,
    assigned_staff_id: row.assigned_staff_id,
    execution_id: row.execution_id,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    completed_at: row.completed_at === null ? null : row.completed_at.toISOString(),
    installation_id: row.installation_id,
})

/** The first row a write or a read answered, as an item; a missing row is a typed not-found. */
export const requireWorkItem = (rows: ReadonlyArray<WorkItemRow>): WorkItem => {
    const row = rows[0]
    if (row === undefined) throw new WorkItemsError({ code: WorkItemsErrorCode.NotFound })
    return toWorkItem(row)
}
