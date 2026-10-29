import { builder } from "@starci/jest-preset"
import type {
    AuthorityRule,
    AuthorityRuleEntity,
    AuthorityRuleRecord,
    RuleChange,
} from "@modules/domain/authority-rules"

/** When the rules of a spec were saved last. */
export const UPDATED = new Date("2026-10-12T10:00:00.000Z")

export const ruleOf = builder<AuthorityRule>({
    id: "rule-1",
    department: "sales",
    action: "send_follow_up",
    mode: "auto",
    limit_vnd: 20_000_000,
    required_fields: ["contact"],
    unit: "vnd",
    auto_max: null,
    ask_max: null,
    agents: [],
})

export const entityOf = builder<AuthorityRuleEntity>({
    id: "rule-1",
    workspaceId: "ws-1",
    department: "sales",
    action: "send_follow_up",
    mode: "auto",
    limitVnd: 20_000_000,
    requiredFields: ["contact"],
    note: "",
    updatedAt: UPDATED,
    unit: "vnd",
    autoMax: null,
    askMax: null,
    approverRoles: ["owner", "manager"],
    approverRooms: [],
    approverMembers: [],
    approvalPolicy: "any",
    timeoutMinutes: 30,
    agents: [],
})

export const recordOf = builder<AuthorityRuleRecord>({
    ...ruleOf(),
    workspace_id: "ws-1",
    note: "",
    updated_at: "2026-10-12T10:00:00.000Z",
    unit: "vnd",
    auto_max: null,
    ask_max: null,
    agents: [],
    approver_roles: ["owner", "manager"],
    approver_rooms: [],
    approver_members: [],
    approval_policy: "any",
    timeout_minutes: 30,
})

export const changeOf = builder<RuleChange>({
    action: "send_follow_up",
    department: "sales",
    mode: "ask",
    limit_vnd: 1000,
    required_fields: ["contact"],
    note: null,
})

/** A stored rule that asks before acting. */
export const askRuleEntity = (): AuthorityRuleEntity => entityOf({ mode: "ask" })

/** A stored ask rule limited to agents one and two. */
export const askRuleForAgentsOneAndTwo = (): AuthorityRuleEntity =>
    entityOf({ mode: "ask", agents: ["agent-1", "agent-2"] })

/** A stored auto rule limited to agent one. */
export const autoRuleForAgentOne = (): AuthorityRuleEntity => entityOf({ agents: ["agent-1"] })

/** A stored ask rule limited to agent one. */
export const askRuleForAgentOne = (): AuthorityRuleEntity => entityOf({ mode: "ask", agents: ["agent-1"] })

/** A stored auto rule with no spending limit. */
export const unlimitedAutoRuleEntity = (): AuthorityRuleEntity => entityOf({ mode: "auto", limitVnd: null })

/** A stored discount rule with its bands, approver group, policy and agents filled. */
export const discountApprovalRuleEntity = (): AuthorityRuleEntity =>
    entityOf({
        action: "give_discount",
        unit: "percent",
        autoMax: 3,
        askMax: 15,
        approverRoles: ["manager"],
        approverRooms: ["sales"],
        approverMembers: ["member-9"],
        approvalPolicy: "sequential",
        timeoutMinutes: 45,
        agents: ["agent-1"],
    })
