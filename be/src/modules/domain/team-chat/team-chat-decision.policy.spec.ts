import { Test } from "@nestjs/testing"
import { ApprovalRequestsErrorCode } from "@modules/domain/approval-requests"
import { refusalOfDecision } from "./team-chat-decision.policy"

const SUBJECT = Symbol("team-chat-decision.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { refusalOfDecision } }],
    }).compile()
    return moduleRef.get<{ refusalOfDecision: typeof refusalOfDecision }>(SUBJECT)
}

describe("refusalOfDecision", () => {
    it("names a missing request, a person who may not decide, and a decision that is closed", async () => {
        const subject = await buildSubject()
        expect(subject.refusalOfDecision(ApprovalRequestsErrorCode.NotFound)).toBe("decision_not_found")
        for (const code of [
            ApprovalRequestsErrorCode.NotInGroup,
            ApprovalRequestsErrorCode.NoGrant,
            ApprovalRequestsErrorCode.OverLimit,
            ApprovalRequestsErrorCode.MemberInactive,
            ApprovalRequestsErrorCode.NotYourTurn,
        ])
            expect(subject.refusalOfDecision(code)).toBe("not_an_approver")
        for (const code of [
            ApprovalRequestsErrorCode.AlreadyApproved,
            ApprovalRequestsErrorCode.AlreadyRejected,
            ApprovalRequestsErrorCode.AlreadyDecided,
            ApprovalRequestsErrorCode.Expired,
        ])
            expect(subject.refusalOfDecision(code)).toBe("decision_closed")
    })

    it("leaves any other failure to fail", async () => {
        const subject = await buildSubject()
        expect(subject.refusalOfDecision(ApprovalRequestsErrorCode.NoRule)).toBeNull()
        expect(subject.refusalOfDecision("SOMETHING_ELSE")).toBeNull()
    })
})
