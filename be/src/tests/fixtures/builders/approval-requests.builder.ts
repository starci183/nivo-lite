import { builder } from "@starci/jest-preset"
import type { ApprovalSetup } from "@modules/domain/authority-rules"
import type { ApproverRef, DirectoryMember, MemberGrant } from "@modules/domain/member-grants"
import type { OpenApprovalParams, ApprovalRequestRow, ApprovalVerdictRow } from "@modules/domain/approval-requests"

/** The moment the specs of the approval requests run at. */
export const NOW = "2026-10-22T09:30:00.000Z"

/** Thirty minutes after {@link NOW}: when a request with the default time runs out. */
export const IN_30_MINUTES = "2026-10-22T10:00:00.000Z"

/** The agent that asks. */
export const AGENT = "22222222-2222-4222-8222-222222222222"

/** One person of the HAKUEN workspace as the directory lists them. */
export const memberOf = builder<DirectoryMember>({
    memberId: "member-owner",
    name: "Chu Van",
    role: "owner",
    roomId: null,
    status: "active",
    rooms: [],
})

export const OWNER = memberOf()
export const MINH = memberOf({
    memberId: "member-minh",
    name: "Anh Minh",
    role: "manager",
    roomId: "sales",
    rooms: ["sales"],
})
export const HA = memberOf({
    memberId: "member-ha",
    name: "Ha",
    role: "manager",
    roomId: "executive",
    rooms: ["executive"],
})
export const LAN = memberOf({ memberId: "member-lan", name: "Lan", role: "staff", roomId: "sales", rooms: ["sales"] })

/** The owner, a manager of Sales, a manager of the executive room and a staff member of Sales. */
export const DIRECTORY: ReadonlyArray<DirectoryMember> = [OWNER, MINH, HA, LAN]

export const OWNER_REF: ApproverRef = { memberId: "member-owner", name: "Chu Van", role: "owner", roomId: null }
export const MINH_REF: ApproverRef = { memberId: "member-minh", name: "Anh Minh", role: "manager", roomId: "sales" }
export const HA_REF: ApproverRef = { memberId: "member-ha", name: "Ha", role: "manager", roomId: "executive" }

/** One grant for the discount action. */
export const grantOf = builder<MemberGrant>({
    id: "grant-1",
    workspace_id: "ws-1",
    member_id: "member-minh",
    action: "give_discount",
    unit: "percent",
    max_amount: 15,
    updated_at: "2026-10-20T09:00:00.000Z",
})

/** Anh Minh may approve up to 15 percent, Ha up to 5. */
export const GRANTS: ReadonlyArray<MemberGrant> = [
    grantOf(),
    grantOf({ id: "grant-2", member_id: "member-ha", max_amount: 5 }),
]

/** The discount rule: auto up to 3 percent, ask up to 20, managers and the Sales room approve, any one of them, thirty minutes. */
export const setupOf = builder<ApprovalSetup>({
    department: "sales",
    action: "give_discount",
    mode: "auto",
    unit: "percent",
    auto_max: 3,
    ask_max: 20,
    group: { roles: ["manager"], rooms: ["sales"], members: [] },
    policy: "any",
    timeout_minutes: 30,
    agents: [],
})

/** What the work chain asks when it opens a request. */
export const openOf = builder<OpenApprovalParams>({
    workspaceId: "ws-1",
    chainStepId: "step-1",
    action: "give_discount",
    amount: 10,
    unit: "percent",
    requestedByAgentId: AGENT,
})

/** A pending request opened {@link NOW}, with Anh Minh tagged. */
export const approvalRequestOf = builder<ApprovalRequestRow>({
    id: "request-1",
    workspace_id: "ws-1",
    chain_step_id: "step-1",
    department: "sales",
    action: "give_discount",
    amount: 10,
    unit: "percent",
    requested_by_agent_id: AGENT,
    policy: "any",
    status: "pending",
    approvers: [MINH_REF],
    excluded: [],
    timeout_minutes: 30,
    expires_at: IN_30_MINUTES,
    reminded_at: null,
    resolved_by: null,
    resolved_at: null,
    escalated_to: null,
    created_at: NOW,
})

/** The approve verdict of Anh Minh. */
export const verdictOf = builder<ApprovalVerdictRow>({ member_id: "member-minh", verdict: "approve", decided_at: NOW })

/** What a spec arranges about the rule and the people. */
export interface Arrangement {
    /** The rule: absent is the discount rule, null is no rule. */
    readonly setup?: ApprovalSetup | null
    /** Everyone of the workspace; absent is the HAKUEN directory. */
    readonly directory?: ReadonlyArray<DirectoryMember>
    /** The grants of the action; absent is {@link GRANTS}. */
    readonly grants?: ReadonlyArray<MemberGrant>
}

/** The rule a spec arranged: the discount rule unless it named another one, or none (null). */
export const setupFor = (arrangement: Arrangement): ApprovalSetup | null =>
    arrangement.setup === undefined ? setupOf() : arrangement.setup
