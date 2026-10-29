import { toRequestRecord } from "./approval-requests.mapper"
import type { ApprovalRequestEntity } from "./persistence/entities"

const rowOf = (over: Partial<ApprovalRequestEntity> = {}): ApprovalRequestEntity =>
    ({
        id: "req-1",
        workspaceId: "ws-1",
        chainStepId: "step-1",
        department: "sales",
        action: "refund",
        amount: 500000,
        unit: "vnd",
        requestedByAgentId: "agent-1",
        policy: "any_one",
        status: "pending",
        approvers: [],
        excluded: [],
        verdicts: [],
        timeoutMinutes: 60,
        expiresAt: new Date("2026-03-02T10:00:00.000Z"),
        remindedAt: null,
        resolvedBy: null,
        resolvedAt: null,
        escalatedTo: null,
        createdAt: new Date("2026-03-02T09:00:00.000Z"),
        ...over,
    }) as unknown as ApprovalRequestEntity

describe("approval requests mapper", () => {
    it("maps an open request with empty moments to null", () => {
        expect(toRequestRecord(rowOf())).toEqual({
            id: "req-1",
            workspace_id: "ws-1",
            chain_step_id: "step-1",
            department: "sales",
            action: "refund",
            amount: 500000,
            unit: "vnd",
            requested_by_agent_id: "agent-1",
            policy: "any_one",
            status: "pending",
            approvers: [],
            excluded: [],
            verdicts: [],
            timeout_minutes: 60,
            expires_at: "2026-03-02T10:00:00.000Z",
            reminded_at: null,
            resolved_by: null,
            resolved_at: null,
            escalated_to: null,
            created_at: "2026-03-02T09:00:00.000Z",
        })
    })

    it("turns reminded and resolved moments into ISO text", () => {
        const record = toRequestRecord(
            rowOf({
                remindedAt: new Date("2026-03-02T09:30:00.000Z"),
                resolvedAt: new Date("2026-03-02T09:45:00.000Z"),
                resolvedBy: "member-minh",
            }),
        )

        expect(record.reminded_at).toBe("2026-03-02T09:30:00.000Z")
        expect(record.resolved_at).toBe("2026-03-02T09:45:00.000Z")
        expect(record.resolved_by).toBe("member-minh")
    })
})
