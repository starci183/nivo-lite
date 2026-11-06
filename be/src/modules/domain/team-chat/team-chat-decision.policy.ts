import { ApprovalRequestsErrorCode } from "@modules/domain/approval-requests"
import type { ApprovalState } from "./team-chat.contracts"

/** What a person answers to a decision. */
export type DecideVerdict = "approve" | "reject"

/** How a decision verdict ended: the state every card of the decision now shows, or why the verdict was refused. */
export type DecideOutcome =
    | { readonly ok: true; readonly approval: ApprovalState }
    | { readonly ok: false; readonly refusal: "decision_not_found" | "not_an_approver" | "decision_closed" }

/** Why a verdict was refused, as the chat names it; null for a failure that is not a refusal of the decision. */
export const refusalOfDecision = (
    code: string,
): "decision_not_found" | "not_an_approver" | "decision_closed" | null => {
    if (code === ApprovalRequestsErrorCode.NotFound) return "decision_not_found"
    if (
        code === ApprovalRequestsErrorCode.NotInGroup ||
        code === ApprovalRequestsErrorCode.NoGrant ||
        code === ApprovalRequestsErrorCode.OverLimit ||
        code === ApprovalRequestsErrorCode.MemberInactive ||
        code === ApprovalRequestsErrorCode.NotYourTurn
    )
        return "not_an_approver"
    if (
        code === ApprovalRequestsErrorCode.AlreadyApproved ||
        code === ApprovalRequestsErrorCode.AlreadyRejected ||
        code === ApprovalRequestsErrorCode.AlreadyDecided ||
        code === ApprovalRequestsErrorCode.Expired
    )
        return "decision_closed"
    return null
}
