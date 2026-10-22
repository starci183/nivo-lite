import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the approval-requests capability. */
export enum ApprovalRequestsErrorCode {
    /** No request with that id. */
    NotFound = "APPROVAL_REQUESTS_NOT_FOUND",
    /** The action has no rule, so there is nobody to ask. */
    NoRule = "APPROVAL_REQUESTS_NO_RULE",
    /** The rule never lets the action run at this amount, so nobody is asked. */
    NotApprovable = "APPROVAL_REQUESTS_NOT_APPROVABLE",
    /** The rule does not apply to the agent that asks. */
    AgentNotCovered = "APPROVAL_REQUESTS_AGENT_NOT_COVERED",
    /** The unit of the request is not the unit of the rule. */
    UnitMismatch = "APPROVAL_REQUESTS_UNIT_MISMATCH",
    /** The member is not in the approver group. */
    NotInGroup = "APPROVAL_REQUESTS_NOT_IN_GROUP",
    /** The member is in the group but holds no grant for the action. */
    NoGrant = "APPROVAL_REQUESTS_NO_GRANT",
    /** The member is in the group but the amount is over their limit. */
    OverLimit = "APPROVAL_REQUESTS_OVER_LIMIT",
    /** The member is disabled. */
    MemberInactive = "APPROVAL_REQUESTS_MEMBER_INACTIVE",
    /** Somebody else approved the request first. */
    AlreadyApproved = "APPROVAL_REQUESTS_ALREADY_APPROVED",
    /** Somebody else rejected the request first. */
    AlreadyRejected = "APPROVAL_REQUESTS_ALREADY_REJECTED",
    /** The amount is negative or not a number. */
    InvalidAmount = "APPROVAL_REQUESTS_INVALID_AMOUNT",
    /** The request ran out of time and went to the owner of the agent. */
    Expired = "APPROVAL_REQUESTS_EXPIRED",
    /** The member already answered this request. */
    AlreadyDecided = "APPROVAL_REQUESTS_ALREADY_DECIDED",
    /** The policy asks the approvers in order and it is not this member's turn. */
    NotYourTurn = "APPROVAL_REQUESTS_NOT_YOUR_TURN",
}

/** How each approval-requests code travels. */
export const APPROVAL_REQUESTS_ERROR_KINDS: Record<ApprovalRequestsErrorCode, ErrorKind> = {
    [ApprovalRequestsErrorCode.NotFound]: "not-found",
    [ApprovalRequestsErrorCode.NoRule]: "invalid",
    [ApprovalRequestsErrorCode.NotApprovable]: "invalid",
    [ApprovalRequestsErrorCode.AgentNotCovered]: "invalid",
    [ApprovalRequestsErrorCode.UnitMismatch]: "invalid",
    [ApprovalRequestsErrorCode.NotInGroup]: "forbidden",
    [ApprovalRequestsErrorCode.NoGrant]: "forbidden",
    [ApprovalRequestsErrorCode.OverLimit]: "forbidden",
    [ApprovalRequestsErrorCode.MemberInactive]: "forbidden",
    [ApprovalRequestsErrorCode.AlreadyApproved]: "conflict",
    [ApprovalRequestsErrorCode.AlreadyRejected]: "conflict",
    [ApprovalRequestsErrorCode.InvalidAmount]: "invalid",
    [ApprovalRequestsErrorCode.Expired]: "conflict",
    [ApprovalRequestsErrorCode.AlreadyDecided]: "conflict",
    [ApprovalRequestsErrorCode.NotYourTurn]: "conflict",
}

/** The one error class of the approval-requests capability. */
export class ApprovalRequestsError extends DomainError<ApprovalRequestsErrorCode> {}
