import type { ApproverGroup } from "@modules/domain/authority-rules"
import type { ApproverRef, DirectoryMember, ExclusionReason } from "@modules/domain/member-grants"
import type { ApproverSet, Refusal } from "./approval-requests.contracts"
import { ApprovalRequestsErrorCode } from "./errors/approval-requests.error"
import type { ApprovalRequestRow } from "./persistence/approval-requests.rows"
import { timeOfDay } from "./verdict.policy"

/** The refusal each reason a grant leaves a member out raises. */
const EXCLUSION_REFUSAL: Readonly<Record<ExclusionReason, ApprovalRequestsErrorCode>> = {
    inactive: ApprovalRequestsErrorCode.MemberInactive,
    no_grant: ApprovalRequestsErrorCode.NoGrant,
    over_limit: ApprovalRequestsErrorCode.OverLimit,
}

/** The member among the people who may answer, or null when they are not. */
export const answererOf = (memberId: string, set: ApproverSet): ApproverRef | null =>
    set.approvers.find((approver) => approver.memberId === memberId) ?? null

/** Why a member who may not answer may not: the reason the grants leave them out, or that they are not in the group at all. */
export const notAnApprover = (memberId: string, set: ApproverSet): Refusal => {
    const excluded = set.excluded.find((one) => one.memberId === memberId)
    return { code: excluded === undefined ? ApprovalRequestsErrorCode.NotInGroup : EXCLUSION_REFUSAL[excluded.reason] }
}

/**
 * What a member who answers a settled request is told: who settled it, how and when ("Anh Minh already approved it at 09:42"); or,
 * for a request that ran out of time, that it went to the owner of the agent.
 */
export const settledBefore = (row: ApprovalRequestRow, directory: ReadonlyArray<DirectoryMember>): Refusal => {
    if (row.status === "expired") return { code: ApprovalRequestsErrorCode.Expired }
    const by = directory.find((member) => member.memberId === row.resolved_by)
    return {
        code:
            row.status === "approved"
                ? ApprovalRequestsErrorCode.AlreadyApproved
                : ApprovalRequestsErrorCode.AlreadyRejected,
        params: { name: by?.name ?? "?", time: timeOfDay(row.resolved_at ?? row.created_at) },
    }
}

/** The people a request named when it opened, as the group to fall back on when its rule is gone. */
export const namedGroup = (row: ApprovalRequestRow): ApproverGroup => ({
    roles: [],
    rooms: [],
    members: row.approvers.map((member) => member.memberId),
})
