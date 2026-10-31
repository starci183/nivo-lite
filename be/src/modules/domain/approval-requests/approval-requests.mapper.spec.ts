import { Test } from "@nestjs/testing"
import { approvalRequestEntityOf } from "@tests/fixtures/builders/approval-requests.builder"
import { toRequestRecord } from "./approval-requests.mapper"

const SUBJECT = Symbol("approval-requests.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toRequestRecord } }],
    }).compile()
    return moduleRef.get<typeof import("./approval-requests.mapper")>(SUBJECT)
}

describe("approval requests mapper", () => {
    it("maps an open request with empty moments to null", async () => {
        const mapper = await buildSubject()

        expect(mapper.toRequestRecord(approvalRequestEntityOf())).toEqual({
            id: "request-1",
            workspace_id: "ws-1",
            chain_step_id: "step-1",
            department: "sales",
            action: "give_discount",
            amount: 10,
            unit: "percent",
            requested_by_agent_id: "22222222-2222-4222-8222-222222222222",
            policy: "any",
            status: "pending",
            approvers: [{ memberId: "member-minh", name: "Anh Minh", role: "manager", roomId: "sales" }],
            excluded: [],
            verdicts: [],
            timeout_minutes: 30,
            expires_at: "2026-10-22T10:00:00.000Z",
            reminded_at: null,
            resolved_by: null,
            resolved_at: null,
            escalated_to: null,
            approver_group: null,
            created_at: "2026-10-22T09:30:00.000Z",
        })
    })

    it("turns reminded and resolved moments into ISO text", async () => {
        const mapper = await buildSubject()
        const settled = Object.assign(approvalRequestEntityOf(), {
            remindedAt: new Date("2026-10-22T09:40:00.000Z"),
            resolvedAt: new Date("2026-10-22T09:45:00.000Z"),
            resolvedBy: "member-minh",
        })

        const record = mapper.toRequestRecord(settled)

        expect(record.reminded_at).toBe("2026-10-22T09:40:00.000Z")
        expect(record.resolved_at).toBe("2026-10-22T09:45:00.000Z")
        expect(record.resolved_by).toBe("member-minh")
    })
})
