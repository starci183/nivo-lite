import type { AgentHead, AppliedRule, RecentWork } from "./agent-profile.contracts"
import type { AgentHeadRow, AppliedRuleRow, RecentWorkRow } from "./persistence/agent-profile.rows"

/** An agent row as the header of its page. */
export const headOf = (row: AgentHeadRow): AgentHead => ({
    id: row.id,
    name: row.name,
    handle: row.handle,
    role: row.role,
    module: row.module,
    status: row.status,
    roomName: row.room_name,
    operatingMode: row.operating_mode,
})

/** A stored rule row as the read-only line of the agent's page. */
export const ruleLineOf = (rule: AppliedRuleRow): AppliedRule => ({
    action: rule.action,
    department: rule.department,
    mode: rule.mode,
    limitVnd: rule.limit_vnd,
    note: rule.note,
})

/** A work item row as one line of recent work; a missing summary or customer is an empty text. */
export const recentOf = (row: RecentWorkRow): RecentWork => ({
    id: row.id,
    action: row.action,
    title: row.summary ?? "",
    customer: row.customer ?? "",
    status: row.status,
    at: row.at,
    leadId: row.lead_id,
})
