import type { ApprovalPolicy, RuleUnit } from "@modules/domain/authority-rules"
import type { ApproverRef } from "@modules/domain/member-grants"
import type { ApprovalExclusion, ApprovalStatus, ApprovalVerdict } from "../approval-requests.contracts"

/** public.approval_requests as the statements select it; the amount arrives converted to a number and the times as ISO text. */
export interface ApprovalRequestRow {
    /** The request id. */
    id: string
    /** The workspace. */
    workspace_id: string
    /** The chain step the request waits for. */
    chain_step_id: string
    /** The module of the action. */
    department: string
    /** The action key. */
    action: string
    /** The amount in `unit`; null when the action carries none. */
    amount: number | null
    /** Constrained by a CHECK in the table. */
    unit: RuleUnit
    /** The agent that asked; null once the agent is deleted. */
    requested_by_agent_id: string | null
    /** Constrained by a CHECK in the table. */
    policy: ApprovalPolicy
    /** Constrained by a CHECK in the table. */
    status: ApprovalStatus
    /** The approvers when the request opened, in the order a sequential policy asks them. */
    approvers: Array<ApproverRef>
    /** The members of the group left out when the request opened. */
    excluded: Array<ApprovalExclusion>
    /** Minutes the request waits. */
    timeout_minutes: number
    /** When it runs out, ISO text. */
    expires_at: string
    /** When the one reminder went out, ISO text; null before. */
    reminded_at: string | null
    /** The member whose verdict settled it; null while pending and when it expired. */
    resolved_by: string | null
    /** When it was settled, ISO text; null while pending. */
    resolved_at: string | null
    /** The member it went to when it expired. */
    escalated_to: string | null
    /** When it opened, ISO text. */
    created_at: string
}

/** One element of `approval_requests.verdicts` as the statement selects it. */
export interface ApprovalVerdictRow {
    /** The member who answered. */
    member_id: string
    /** What they answered. */
    verdict: ApprovalVerdict
    /** When, ISO text. */
    decided_at: string
}

/** The id of the workspace owner seat. */
export interface OwnerSeatRow {
    /** The member id; null when the workspace has no active owner. */
    id: string | null
}
