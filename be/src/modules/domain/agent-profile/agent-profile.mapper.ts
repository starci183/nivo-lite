import { storedAvatarAddress } from "@modules/integrations/object-storage"
import type { AuthorityRuleEntity } from "@modules/domain/authority-rules"
import type { AgentHead, AppliedRule, RecentWork } from "./agent-profile.contracts"
import type { AgentHeadRead, RecentWorkRead } from "./agent-profile-reads.contracts"

/** An agent row as the header of its page. */
export const headOf = (row: AgentHeadRead): AgentHead => ({
    id: row.id,
    name: row.name,
    handle: row.handle,
    role: row.role,
    module: row.module,
    status: row.status,
    avatarUrl: storedAvatarAddress(row.avatarUrl),
    roomName: row.roomName,
    operatingMode: row.operatingMode,
})

/** A stored rule row as the read-only line of the agent's page. */
export const ruleLineOf = (
    rule: Pick<AuthorityRuleEntity, "action" | "department" | "mode" | "limitVnd" | "note">,
): AppliedRule => ({
    action: rule.action,
    department: rule.department,
    mode: rule.mode,
    limitVnd: rule.limitVnd,
    note: rule.note,
})

/** A work item row as one line of recent work; a missing summary or customer is an empty text. */
export const recentOf = (row: RecentWorkRead): RecentWork => ({
    id: row.id,
    action: row.action,
    title: row.summary ?? "",
    customer: row.customer ?? "",
    status: row.status,
    at: row.at,
    leadId: row.leadId,
})
