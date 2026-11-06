import { ApprovalRequestsErrorCode } from "@modules/domain/approval-requests"
import { refusalOfDecision } from "./decide-chat-approval.policy"

describe("refusalOfDecision", () => {
    it("names a missing request, a person who may not decide, and a decision that is closed", () => {
        expect(refusalOfDecision(ApprovalRequestsErrorCode.NotFound)).toBe("decision_not_found")
        for (const code of [
            ApprovalRequestsErrorCode.NotInGroup,
            ApprovalRequestsErrorCode.NoGrant,
            ApprovalRequestsErrorCode.OverLimit,
            ApprovalRequestsErrorCode.MemberInactive,
            ApprovalRequestsErrorCode.NotYourTurn,
        ])
            expect(refusalOfDecision(code)).toBe("not_an_approver")
        for (const code of [
            ApprovalRequestsErrorCode.AlreadyApproved,
            ApprovalRequestsErrorCode.AlreadyRejected,
            ApprovalRequestsErrorCode.AlreadyDecided,
            ApprovalRequestsErrorCode.Expired,
        ])
            expect(refusalOfDecision(code)).toBe("decision_closed")
    })

    it("leaves any other failure to fail", () => {
        expect(refusalOfDecision(ApprovalRequestsErrorCode.NoRule)).toBeNull()
        expect(refusalOfDecision("SOMETHING_ELSE")).toBeNull()
    })
})
