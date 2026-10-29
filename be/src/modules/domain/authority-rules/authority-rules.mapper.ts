import type { ApprovalSetup, AuthorityRule, AuthorityRuleRecord } from "./authority-rules.contracts"
import type { AuthorityRuleEntity } from "./persistence/entities"

/** The rule an action gate reads, in the snake-case contract shape. */
export const toRule = (row: AuthorityRuleEntity): AuthorityRule => ({
    id: row.id,
    department: row.department,
    action: row.action,
    mode: row.mode,
    limit_vnd: row.limitVnd,
    required_fields: row.requiredFields,
    unit: row.unit,
    auto_max: row.autoMax,
    ask_max: row.askMax,
    agents: row.agents,
})

/** The stored rule the Authority page lists, with its workspace, note and approval settings. */
export const toRuleRecord = (row: AuthorityRuleEntity): AuthorityRuleRecord => ({
    ...toRule(row),
    workspace_id: row.workspaceId,
    note: row.note,
    updated_at: row.updatedAt.toISOString(),
    unit: row.unit,
    auto_max: row.autoMax,
    ask_max: row.askMax,
    agents: row.agents,
    approver_roles: row.approverRoles,
    approver_rooms: row.approverRooms,
    approver_members: row.approverMembers,
    approval_policy: row.approvalPolicy,
    timeout_minutes: row.timeoutMinutes,
})

/** The approval side of a stored rule. */
export const toApprovalSetup = (row: AuthorityRuleEntity): ApprovalSetup => ({
    department: row.department,
    action: row.action,
    mode: row.mode,
    unit: row.unit,
    auto_max: row.autoMax,
    ask_max: row.askMax,
    group: { roles: row.approverRoles, rooms: row.approverRooms, members: row.approverMembers },
    policy: row.approvalPolicy,
    timeout_minutes: row.timeoutMinutes,
    agents: row.agents,
})
