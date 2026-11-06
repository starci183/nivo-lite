import { Test } from "@nestjs/testing"
import { approvalStateOf } from "./team-chat-approval.policy"

const SUBJECT = Symbol("team-chat-approval.policy")

const DECIDED = new Date("2026-11-06T10:00:00.000Z")
const STANDING = {
    id: "11111111-1111-4111-8111-111111111111",
    status: "pending",
    resolvedAt: null,
    resolvedBy: null,
    askedSeatIds: ["seat-1", "seat-2"],
} as const

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { approvalStateOf } }],
    }).compile()
    return moduleRef.get<{ approvalStateOf: typeof approvalStateOf }>(SUBJECT)
}

describe("approvalStateOf", () => {
    it("lets a seat that was asked decide a pending request, and nobody else", async () => {
        const subject = await buildSubject()
        const names = new Map<string, string>()
        expect(subject.approvalStateOf(STANDING, "seat-2", names)).toEqual({
            decisionId: STANDING.id,
            status: "pending",
            decidedByName: null,
            decidedAt: null,
            canDecide: true,
        })
        expect(subject.approvalStateOf(STANDING, "seat-9", names).canDecide).toBe(false)
        expect(subject.approvalStateOf(STANDING, null, names).canDecide).toBe(false)
    })

    it("reads a rejected request as refused, names who settled it, and lets nobody decide it again", async () => {
        const subject = await buildSubject()
        const settled = { ...STANDING, status: "rejected", resolvedAt: DECIDED, resolvedBy: "seat-1" } as const
        expect(subject.approvalStateOf(settled, "seat-1", new Map([["seat-1", "Lan"]]))).toEqual({
            decisionId: STANDING.id,
            status: "refused",
            decidedByName: "Lan",
            decidedAt: DECIDED,
            canDecide: false,
        })
        expect(subject.approvalStateOf({ ...settled, status: "approved" }, "seat-1", new Map()).status).toBe("approved")
    })

    it("has no name for a settler whose seat is gone, and none for a request that ran out of time", async () => {
        const subject = await buildSubject()
        const settled = { ...STANDING, status: "approved", resolvedBy: "seat-9" } as const
        expect(subject.approvalStateOf(settled, null, new Map()).decidedByName).toBeNull()
        expect(subject.approvalStateOf({ ...STANDING, status: "expired" }, null, new Map())).toMatchObject({
            status: "expired",
            decidedByName: null,
        })
    })
})
