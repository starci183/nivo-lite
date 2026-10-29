import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { isRecord } from "@modules/platform/primitives"
import type {
    ClosedClaim,
    NewWorkItem,
    Proposal,
    StoredProposal,
    WorkItem,
    WorkItemRecord,
} from "./work-items.contracts"
import type { WorkItemEntity } from "./persistence/entities"
import { WorkItemsError, WorkItemsErrorCode } from "./errors/work-items.error"

/** A stored proposal as the engine uses it: a legacy row may hold an empty object, so the summary and the fields get their defaults. */
export const toProposal = (stored: StoredProposal): Proposal => ({
    ...stored,
    summary: stored.summary ?? "",
    fields: stored.fields ?? {},
})

/** One work item row as the contract: timestamps as ISO strings, the proposal complete. */
export const toWorkItem = (row: WorkItemRecord): WorkItem => ({
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

/** A stored work item as the record the writes answer, so a read and a write reach the contract through one mapper. */
export const toWorkItemRecord = (entity: WorkItemEntity): WorkItemRecord => ({
    id: entity.id,
    workspace_id: entity.workspaceId,
    department: entity.department,
    action: entity.action,
    subject_type: entity.subjectType,
    subject_id: entity.subjectId,
    lead_id: entity.leadId,
    inbound_event_id: entity.inboundEventId,
    parent_id: entity.parentId,
    chain_id: entity.chainId,
    depth: entity.depth,
    status: entity.status,
    decided_path: entity.decidedPath,
    reason: entity.reason,
    reasons: entity.reasons,
    missing_fields: entity.missingFields,
    proposal: entity.proposal,
    result: entity.result,
    error: entity.error,
    evidence_state: entity.evidenceState,
    assigned_staff_id: entity.assignedStaffId,
    execution_id: entity.executionId,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
    completed_at: entity.completedAt,
    installation_id: entity.installationId,
})

/** The first row a write or a read answered, as an item; a missing row is a typed not-found. */
export const requireWorkItem = (rows: ReadonlyArray<WorkItemRecord>): WorkItem => {
    const row = rows[0]
    if (row === undefined) throw new WorkItemsError({ code: WorkItemsErrorCode.NotFound })
    return toWorkItem(row)
}

/** A RETURNING row names its item; the columns beyond `id` are those the write asked for (`*` for a whole item). */
const isWorkItemRecord = (value: unknown): value is WorkItemRecord => isRecord(value) && typeof value.id === "string"

const isClosedClaim = (value: unknown): value is ClosedClaim => isRecord(value) && typeof value.id === "string"

/** The item rows a RETURNING write answered; none when it answered no rows. */
export const recordsOfRaw = (raw: unknown): Array<WorkItemRecord> =>
    Array.isArray(raw) ? raw.filter(isWorkItemRecord) : []

/** The claims a RETURNING write closed; none when it closed no rows. */
export const closedClaimsOf = (raw: unknown): Array<ClosedClaim> =>
    Array.isArray(raw) ? raw.filter(isClosedClaim) : []

/** The columns of a queued item: a root item is the root of its own chain, so `id` names the chain when the item names none. */
export const queuedValuesOf = (item: NewWorkItem, id: string): QueryDeepPartialEntity<WorkItemEntity> => ({
    id,
    workspaceId: item.workspaceId,
    chainId: item.chainId ?? id,
    depth: item.depth,
    department: item.department,
    action: item.action,
    subjectType: item.subjectType,
    subjectId: item.subjectId,
    leadId: item.leadId,
    inboundEventId: item.inboundEventId,
    parentId: item.parentId,
    dedupeKey: item.dedupeKey,
    status: "queued",
    proposal: item.proposal,
    installationId: item.installationId,
})
