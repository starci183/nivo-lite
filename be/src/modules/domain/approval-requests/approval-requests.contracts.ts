import type { ApprovalPolicy, ApprovalSetup, ApproverGroup, RuleUnit } from "@modules/domain/authority-rules"
import type {
    ApproverRef,
    DirectoryMember,
    ExclusionReason,
    GrantNeed,
    MemberGrant,
} from "@modules/domain/member-grants"

import type { ErrorParams } from "@modules/platform/errors"
import type { ApprovalRequestsErrorCode } from "./errors/approval-requests.error"

/** What a member answers a request: approve or reject. */
export type ApprovalVerdict = "approve" | "reject"

/** Where a request stands: waiting for its approvers, settled by them, or run out of time. */
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired"

/** How a request ended. */
export type ApprovalOutcome = Exclude<ApprovalStatus, "pending">

/** What opening a request takes (the contract shared with the work chain). */
export interface OpenApprovalParams {
    /** The workspace. */
    readonly workspaceId: string
    /** The step of the execution chain that waits for the approval. */
    readonly chainStepId: string
    /** The action key whose rule decides who approves. */
    readonly action: string
    /** The amount of the request in `unit`; null when the action carries none. */
    readonly amount: number | null
    /** What the amount is counted in; it must be the unit of the rule. */
    readonly unit: RuleUnit
    /** The agent that asks; the owner of this agent receives the request when nobody answers in time. */
    readonly requestedByAgentId: string
}

/** A member of the approver group who cannot approve this request, and why. */
export interface ApprovalExclusion {
    /** The member. */
    readonly memberId: string
    /** Why: disabled, no grant for the action, or the amount is over their limit. */
    readonly reason: ExclusionReason
}

/** What opening a request answers: the request, the people tagged, the people left out and when it runs out. */
export interface OpenedApproval {
    /** The request. */
    readonly requestId: string
    /** The people tagged: the approver group that the grants cover, in the order a sequential policy asks them. */
    readonly approvers: ReadonlyArray<ApproverRef>
    /** The people of the group left out, each with the reason. */
    readonly excluded: ReadonlyArray<ApprovalExclusion>
    /** How the approvers decide. */
    readonly policy: ApprovalPolicy
    /** When the request runs out and goes to the owner of the agent, ISO 8601. */
    readonly expiresAt: string
}

/** What a member's verdict takes. */
export interface DecideApprovalParams {
    /** The request. */
    readonly requestId: string
    /** The member who answers; the server proves they may. */
    readonly memberId: string
    /** Approve or reject. */
    readonly verdict: ApprovalVerdict
}

/** Where a request stands after a verdict. */
export interface ApprovalProgress {
    /** The request. */
    readonly requestId: string
    /** `pending` while more approvers have to answer, else how it ended. */
    readonly status: ApprovalStatus
    /** The members who approved so far. */
    readonly approvedBy: ReadonlyArray<string>
    /** The members whose answer is still awaited (empty once the request is settled). */
    readonly remaining: ReadonlyArray<ApproverRef>
}

/** The event published when a request is settled (the contract shared with the work chain: `approval.resolved`). */
export interface ApprovalResolved {
    /** The request. */
    readonly requestId: string
    /** Approved, rejected, or expired. */
    readonly outcome: ApprovalOutcome
    /** The member whose verdict settled it; null when it expired. */
    readonly decidedBy: string | null
    /** The display name of that member; null when it expired. */
    readonly decidedByName: string | null
    /** The action key the request was about. */
    readonly action: string
    /** The workspace of the request. */
    readonly workspaceId: string
    /** The chain step the request was opened for. */
    readonly chainStepId: string
    /** The member the request went to when it expired: the owner of the agent (or their fallback, or the workspace owner); null otherwise. */
    readonly escalatedTo: ApproverRef | null
}

/** The event published once, half-way through the time of a pending request: the people who have not answered yet. */
export interface ApprovalReminder {
    /** The request. */
    readonly requestId: string
    /** The workspace of the request. */
    readonly workspaceId: string
    /** The chain step the request was opened for. */
    readonly chainStepId: string
    /** The action key the request is about. */
    readonly action: string
    /** The approvers who have not answered. */
    readonly remaining: ReadonlyArray<ApproverRef>
    /** When the request runs out, ISO 8601. */
    readonly expiresAt: string
}

/** What a minute tick of the sweep did. */
export interface ApprovalSweep {
    /** The requests that ran out of time. */
    readonly expired: number
    /** The requests whose approvers were reminded. */
    readonly reminded: number
}

/** The people who may approve a request, from the live group, the directory and the grants. */
export interface ApproverSet {
    /** The approvers, in the order a sequential policy asks them. */
    readonly approvers: ReadonlyArray<ApproverRef>
    /** The members of the group left out, with the reason. */
    readonly excluded: ReadonlyArray<ApprovalExclusion>
}

/** What resolving an approver set reads. */
export interface ApproverInput {
    /** The group of the rule. */
    readonly group: ApproverGroup
    /** Everyone of the workspace. */
    readonly directory: ReadonlyArray<DirectoryMember>
    /** The grants of the action. */
    readonly grants: ReadonlyArray<MemberGrant>
    /** What the request needs of an approver. */
    readonly need: GrantNeed
}

/** One verdict already given. */
export interface GivenVerdict {
    /** The member who answered. */
    readonly memberId: string
    /** What they answered. */
    readonly verdict: ApprovalVerdict
}

/** What writing a new request takes, once the rule and the approver set are known. */
export interface OpenWrite {
    /** What the work chain asked for. */
    readonly params: OpenApprovalParams
    /** The approval side of the rule of the action. */
    readonly setup: ApprovalSetup
    /** The people the grants cover and the people left out. */
    readonly set: ApproverSet
    /** Everyone of the workspace, for the hand-over when nobody can approve. */
    readonly directory: ReadonlyArray<DirectoryMember>
    /** The moment of the request. */
    readonly now: Date
    /** When the request runs out. */
    readonly expiresAt: Date
}

/** Why a member may not answer a request, or why the request cannot be answered: the code and its text parameters. */
export interface Refusal {
    /** The code of the refusal. */
    readonly code: ApprovalRequestsErrorCode
    /** The values of its text. */
    readonly params?: ErrorParams
}

/** One verdict a member gave a request, as the request stores it. */
export interface ApprovalVerdictRecord {
    /** The member who answered. */
    readonly member_id: string
    /** What they answered. */
    readonly verdict: ApprovalVerdict
    /** When they answered, as ISO text. */
    readonly decided_at: string
}

/** A stored request for approval as the services read it: the moments are ISO text, the amount a number. */
export interface ApprovalRequestRecord {
    /** The request. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The chain step it asks about. */
    readonly chain_step_id: string
    /** The module of the action. */
    readonly department: string
    /** The action. */
    readonly action: string
    /** The amount, or null. */
    readonly amount: number | null
    /** What the amount is counted in. */
    readonly unit: RuleUnit
    /** The agent that asked, or null. */
    readonly requested_by_agent_id: string | null
    /** How the approvers decide. */
    readonly policy: ApprovalPolicy
    /** Where the request stands. */
    readonly status: ApprovalStatus
    /** Who was asked when it opened. */
    readonly approvers: ReadonlyArray<ApproverRef>
    /** Who was left out, and why. */
    readonly excluded: ReadonlyArray<ApprovalExclusion>
    /** The verdicts given so far, in the order they were given. */
    readonly verdicts: ReadonlyArray<ApprovalVerdictRecord>
    /** Minutes before it runs out. */
    readonly timeout_minutes: number
    /** When it runs out, as ISO text. */
    readonly expires_at: string
    /** When the approvers were reminded, or null. */
    readonly reminded_at: string | null
    /** The member who settled it, or null. */
    readonly resolved_by: string | null
    /** When it was settled, or null. */
    readonly resolved_at: string | null
    /** The member it went to when it expired, or null. */
    readonly escalated_to: string | null
    /** When it opened, as ISO text. */
    readonly created_at: string
}
