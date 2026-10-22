import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { ApproverRef } from "@modules/domain/member-grants"
import { ApprovalRequestsErrorCode } from "./errors/approval-requests.error"
import { judgeVerdict, timeOfDay } from "./verdict.policy"
import type { VerdictInput } from "./verdict.policy"

const SUBJECT = Symbol("verdict.policy")

const refOf = builder<ApproverRef>({ memberId: "member-1", name: "Anh Minh", role: "manager", roomId: "sales" })

const MINH = refOf()
const HA = refOf({ memberId: "member-2", name: "Ha" })
const NAM = refOf({ memberId: "member-3", name: "Nam", role: "staff" })

const inputOf = builder<VerdictInput>({
    policy: "any",
    eligible: [MINH, HA, NAM],
    given: [],
    memberId: "member-1",
    verdict: "approve",
})

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { judgeVerdict, timeOfDay } }],
    }).compile()
    return moduleRef.get<{ judgeVerdict: typeof judgeVerdict; timeOfDay: typeof timeOfDay }>(SUBJECT)
}

describe("verdict policy > any one", () => {
    it("settles the request with the first answer, approval or rejection", async () => {
        const subject = await buildSubject()

        expect(subject.judgeVerdict(inputOf())).toEqual({ kind: "ok", value: { settled: true, outcome: "approved" } })
        expect(subject.judgeVerdict(inputOf({ verdict: "reject" }))).toEqual({
            kind: "ok",
            value: { settled: true, outcome: "rejected" },
        })
    })

    it("refuses a second answer from the same member", async () => {
        const subject = await buildSubject()
        const given = [{ memberId: "member-1", verdict: "approve" as const }]

        expect(subject.judgeVerdict(inputOf({ given }))).toEqual({
            kind: "refused",
            code: ApprovalRequestsErrorCode.AlreadyDecided,
            params: undefined,
        })
    })
})

describe("verdict policy > all", () => {
    it("waits for every approver and names the ones still awaited", async () => {
        const subject = await buildSubject()

        expect(subject.judgeVerdict(inputOf({ policy: "all" }))).toEqual({
            kind: "ok",
            value: { settled: false, remaining: [HA, NAM] },
        })
    })

    it("approves with the last approval", async () => {
        const subject = await buildSubject()
        const given = [
            { memberId: "member-2", verdict: "approve" as const },
            { memberId: "member-3", verdict: "approve" as const },
        ]

        expect(subject.judgeVerdict(inputOf({ policy: "all", given }))).toEqual({
            kind: "ok",
            value: { settled: true, outcome: "approved" },
        })
    })

    it("rejects with the first rejection, however many approved before", async () => {
        const subject = await buildSubject()
        const given = [{ memberId: "member-2", verdict: "approve" as const }]

        expect(subject.judgeVerdict(inputOf({ policy: "all", given, verdict: "reject" }))).toEqual({
            kind: "ok",
            value: { settled: true, outcome: "rejected" },
        })
    })

    it("does not wait for a member who lost the right to approve since they approved or since the request opened", async () => {
        const subject = await buildSubject()
        const given = [{ memberId: "member-9", verdict: "approve" as const }]

        expect(subject.judgeVerdict(inputOf({ policy: "all", eligible: [MINH], given }))).toEqual({
            kind: "ok",
            value: { settled: true, outcome: "approved" },
        })
    })
})

describe("verdict policy > sequential", () => {
    it("lets the first of the group answer and waits for the rest in order", async () => {
        const subject = await buildSubject()

        expect(subject.judgeVerdict(inputOf({ policy: "sequential" }))).toEqual({
            kind: "ok",
            value: { settled: false, remaining: [HA, NAM] },
        })
    })

    it("refuses a member whose turn it is not, naming who is next, for an approval and for a rejection", async () => {
        const subject = await buildSubject()
        const input = inputOf({ policy: "sequential", memberId: "member-3" })

        const refusal = {
            kind: "refused",
            code: ApprovalRequestsErrorCode.NotYourTurn,
            params: { name: "Anh Minh" },
        }
        expect(subject.judgeVerdict(input)).toEqual(refusal)
        expect(subject.judgeVerdict({ ...input, verdict: "reject" })).toEqual(refusal)
    })

    it("asks the next one after an approval", async () => {
        const subject = await buildSubject()
        const given = [{ memberId: "member-1", verdict: "approve" as const }]

        expect(subject.judgeVerdict(inputOf({ policy: "sequential", given, memberId: "member-2" }))).toEqual({
            kind: "ok",
            value: { settled: false, remaining: [NAM] },
        })
    })

    it("approves with the last one's approval", async () => {
        const subject = await buildSubject()
        const given = [
            { memberId: "member-1", verdict: "approve" as const },
            { memberId: "member-2", verdict: "approve" as const },
        ]

        expect(subject.judgeVerdict(inputOf({ policy: "sequential", given, memberId: "member-3" }))).toEqual({
            kind: "ok",
            value: { settled: true, outcome: "approved" },
        })
    })

    it("rejects with the rejection of the one whose turn it is", async () => {
        const subject = await buildSubject()

        expect(subject.judgeVerdict(inputOf({ policy: "sequential", verdict: "reject" }))).toEqual({
            kind: "ok",
            value: { settled: true, outcome: "rejected" },
        })
    })

    it("skips a member who lost the right to approve when it asks the next one", async () => {
        const subject = await buildSubject()

        expect(subject.judgeVerdict(inputOf({ policy: "sequential", eligible: [NAM], memberId: "member-3" }))).toEqual({
            kind: "ok",
            value: { settled: true, outcome: "approved" },
        })
    })
})

describe("verdict policy > timeOfDay", () => {
    it("reads the time in Vietnam, in hours and minutes on the 24-hour clock", async () => {
        const subject = await buildSubject()

        expect(subject.timeOfDay("2026-10-22T02:42:30.000Z")).toBe("09:42")
        expect(subject.timeOfDay("2026-10-22T17:05:00.000Z")).toBe("00:05")
    })
})
