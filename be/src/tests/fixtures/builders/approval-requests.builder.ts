import { builder } from "@starci/jest-preset"
import type { ApprovalSetup } from "@modules/domain/authority-rules"
import type { ApproverRef, DirectoryMember, MemberGrant } from "@modules/domain/member-grants"
import { approvalRequestsEntities } from "@modules/domain/approval-requests"
import type {
    OpenApprovalParams,
    ApprovalRequestRecord,
    ApprovalVerdictRecord,
} from "@modules/domain/approval-requests"

const [ApprovalRequestEntity] = approvalRequestsEntities
type ApprovalRequestEntity = InstanceType<typeof ApprovalRequestEntity>

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
export const approvalRequestOf = builder<ApprovalRequestRecord>({
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
    verdicts: [],
    excluded: [],
    timeout_minutes: 30,
    expires_at: IN_30_MINUTES,
    reminded_at: null,
    resolved_by: null,
    resolved_at: null,
    escalated_to: null,
    created_at: NOW,
})

/** The stored row of {@link approvalRequestOf}: a pending request opened {@link NOW}, with Anh Minh tagged. */
export const approvalRequestEntityOf = builder<ApprovalRequestEntity>({
    id: "request-1",
    workspaceId: "ws-1",
    chainStepId: "step-1",
    department: "sales",
    action: "give_discount",
    amount: 10,
    unit: "percent",
    requestedByAgentId: AGENT,
    policy: "any",
    status: "pending",
    approvers: [MINH_REF],
    excluded: [],
    verdicts: [],
    timeoutMinutes: 30,
    expiresAt: new Date(IN_30_MINUTES),
    remindedAt: null,
    resolvedBy: null,
    resolvedAt: null,
    escalatedTo: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
})

/** The approve verdict of Anh Minh. */
export const verdictOf = builder<ApprovalVerdictRecord>({
    member_id: "member-minh",
    verdict: "approve",
    decided_at: NOW,
})

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

/** A request that ran out of time and was settled as expired at {@link NOW}. */
export const expiredRequestSettledNow = (): ApprovalRequestEntity =>
    approvalRequestEntityOf({ status: "expired", resolvedAt: new Date(NOW) })

/** A pending request whose time ran out one second before it is read. */
export const requestPastItsTime = (): ApprovalRequestEntity =>
    approvalRequestEntityOf({ expiresAt: new Date("2026-10-22T09:00:00.000Z") })

/** A pending request tagged to Anh Minh and Ha. */
export const requestForMinhAndHa = (): ApprovalRequestEntity =>
    approvalRequestEntityOf({ approvers: [MINH_REF, HA_REF] })

/** A pending request that Anh Minh and Ha answer one after the other. */
export const sequentialRequestForMinhAndHa = (): ApprovalRequestEntity =>
    approvalRequestEntityOf({ policy: "sequential", approvers: [MINH_REF, HA_REF] })

/** A pending request that asks its approvers in order, tagging only Anh Minh. */
export const sequentialRequest = (): ApprovalRequestEntity => approvalRequestEntityOf({ policy: "sequential" })

/** A pending request that carries no amount. */
export const requestWithoutAmount = (): ApprovalRequestEntity => approvalRequestEntityOf({ amount: null })

/** A pending request for Anh Minh and Ha that left Lan out for lack of a grant. */
export const requestExcludingLan = (): ApprovalRequestEntity =>
    approvalRequestEntityOf({
        approvers: [MINH_REF, HA_REF],
        excluded: [{ memberId: "member-lan", reason: "no_grant" }],
    })

/** A pending request with nobody tagged that expires at {@link NOW}. */
export const requestWithoutApproversExpiringNow = (): ApprovalRequestEntity =>
    approvalRequestEntityOf({ approvers: [], expiresAt: new Date(NOW) })

/** A pending request that expires one minute before {@link NOW}. */
export const requestExpiredBeforeNow = (): ApprovalRequestEntity =>
    approvalRequestEntityOf({ expiresAt: new Date("2026-10-22T09:29:00.000Z") })

/** A second pending request, of the chain step `step-2`. */
export const requestOfSecondStep = (): ApprovalRequestEntity =>
    approvalRequestEntityOf({ id: "request-2", chainStepId: "step-2" })

/** An all-approve request for Anh Minh and Ha where Anh Minh already approved. */
export const allApproveRequestMinhApproved = (): ApprovalRequestEntity =>
    approvalRequestEntityOf({ policy: "all", approvers: [MINH_REF, HA_REF], verdicts: [verdictOf()] })

/** What the escalation writes onto a request it expires toward Anh Minh. */
export const ESCALATION_EXPIRY_SET = {
    status: "expired",
    resolvedBy: null,
    resolvedAt: new Date(NOW),
    escalatedTo: "member-minh",
}

/** An approved sales refund resolved by member m-1 on step c-1, as the history reads see it. */
export const historyRequestOf = builder<ApprovalRequestEntity>({
    ...approvalRequestEntityOf(),
    id: "r-1",
    department: "sales",
    action: "refund",
    status: "approved",
    resolvedBy: "m-1",
    chainStepId: "c-1",
    resolvedAt: new Date("2026-10-12T03:00:00.000Z"),
    createdAt: new Date("2026-10-11T03:00:00.000Z"),
})

/** The request r-2 that expired without anybody resolving it. */
export const expiredUnresolvedRequest = (): ApprovalRequestEntity =>
    historyRequestOf({ id: "r-2", resolvedAt: null, status: "expired" })

/** A history request still waiting. */
export const pendingHistoryRequest = (): ApprovalRequestEntity => historyRequestOf({ status: "pending" })
