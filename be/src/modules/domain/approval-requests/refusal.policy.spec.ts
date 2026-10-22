import { Test } from "@nestjs/testing"
import { DIRECTORY, MINH_REF, approvalRequestOf } from "@tests/fixtures/builders/approval-requests.builder"
import type { ApproverSet } from "./approval-requests.contracts"
import { ApprovalRequestsErrorCode } from "./errors/approval-requests.error"
import { answererOf, namedGroup, notAnApprover, settledBefore } from "./refusal.policy"

const SUBJECT = Symbol("refusal.policy")

const SET: ApproverSet = {
    approvers: [MINH_REF],
    excluded: [
        { memberId: "member-ha", reason: "over_limit" },
        { memberId: "member-lan", reason: "no_grant" },
        { memberId: "member-owner", reason: "inactive" },
    ],
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { answererOf, namedGroup, notAnApprover, settledBefore } }],
    }).compile()
    return moduleRef.get<typeof import("./refusal.policy")>(SUBJECT)
}

describe("refusal policy > who may answer", () => {
    it("lets only the people the grants cover answer", async () => {
        const subject = await buildSubject()

        expect(subject.answererOf("member-minh", SET)).toEqual(MINH_REF)
        expect(subject.answererOf("member-ha", SET)).toBeNull()
        expect(subject.answererOf("stranger", SET)).toBeNull()
    })

    it.each([
        ["member-ha", ApprovalRequestsErrorCode.OverLimit],
        ["member-lan", ApprovalRequestsErrorCode.NoGrant],
        ["member-owner", ApprovalRequestsErrorCode.MemberInactive],
        ["stranger", ApprovalRequestsErrorCode.NotInGroup],
    ])("tells %s why they may not answer", async (memberId, code) => {
        const subject = await buildSubject()

        expect(subject.notAnApprover(memberId, SET)).toEqual({ code })
    })

    it("falls back to the people the request named when its rule is gone", async () => {
        const subject = await buildSubject()

        expect(subject.namedGroup(approvalRequestOf({ approvers: [MINH_REF] }))).toEqual({
            roles: [],
            rooms: [],
            members: ["member-minh"],
        })
    })
})

describe("refusal policy > a request somebody settled first", () => {
    const settled = { resolved_by: "member-minh", resolved_at: "2026-10-22T02:42:00.000Z" }

    it("names who approved it and when, in Vietnam time", async () => {
        const subject = await buildSubject()

        expect(subject.settledBefore(approvalRequestOf({ ...settled, status: "approved" }), DIRECTORY)).toEqual({
            code: ApprovalRequestsErrorCode.AlreadyApproved,
            params: { name: "Anh Minh", time: "09:42" },
        })
    })

    it("names who rejected it and when", async () => {
        const subject = await buildSubject()

        expect(subject.settledBefore(approvalRequestOf({ ...settled, status: "rejected" }), DIRECTORY)).toEqual({
            code: ApprovalRequestsErrorCode.AlreadyRejected,
            params: { name: "Anh Minh", time: "09:42" },
        })
    })

    it("names an unknown settler with a question mark rather than failing, and reads the open time when there is no settle time", async () => {
        const subject = await buildSubject()
        const row = approvalRequestOf({
            status: "approved",
            resolved_by: null,
            resolved_at: null,
            created_at: "2026-10-22T09:30:00.000Z",
        })

        expect(subject.settledBefore(row, DIRECTORY)).toEqual({
            code: ApprovalRequestsErrorCode.AlreadyApproved,
            params: { name: "?", time: "16:30" },
        })
    })

    it("tells a request that ran out of time that it went to the owner of the agent", async () => {
        const subject = await buildSubject()

        expect(subject.settledBefore(approvalRequestOf({ status: "expired" }), DIRECTORY)).toEqual({
            code: ApprovalRequestsErrorCode.Expired,
        })
    })
})
