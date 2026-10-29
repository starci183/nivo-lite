import type { ApprovalRequestRecord } from "./approval-requests.contracts"
import type { ApprovalRequestEntity } from "./persistence/entities"

const iso = (at: Date | null): string | null => (at === null ? null : at.toISOString())

/** A stored request as the services read it: the moments become ISO text. */
export const toRequestRecord = (row: ApprovalRequestEntity): ApprovalRequestRecord => ({
    id: row.id,
    workspace_id: row.workspaceId,
    chain_step_id: row.chainStepId,
    department: row.department,
    action: row.action,
    amount: row.amount,
    unit: row.unit,
    requested_by_agent_id: row.requestedByAgentId,
    policy: row.policy,
    status: row.status,
    approvers: row.approvers,
    excluded: row.excluded,
    verdicts: row.verdicts,
    timeout_minutes: row.timeoutMinutes,
    expires_at: row.expiresAt.toISOString(),
    reminded_at: iso(row.remindedAt),
    resolved_by: row.resolvedBy,
    resolved_at: iso(row.resolvedAt),
    escalated_to: row.escalatedTo,
    created_at: row.createdAt.toISOString(),
})
