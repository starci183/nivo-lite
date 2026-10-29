import { toApprovalSetup, toRule, toRuleRecord } from "./authority-rules.mapper"
import type { AuthorityRuleEntity } from "./persistence/entities"

const rowOf = (): AuthorityRuleEntity =>
    ({
        id: "rule-1",
        workspaceId: "ws-1",
        department: "sales",
        action: "refund",
        mode: "ask",
        limitVnd: 1000000,
        requiredFields: ["order_id"],
        unit: "vnd",
        autoMax: 100000,
        askMax: 900000,
        agents: ["agent-1"],
        note: "careful",
        updatedAt: new Date("2026-03-02T09:00:00.000Z"),
        approverRoles: ["owner"],
        approverRooms: ["room-1"],
        approverMembers: ["member-minh"],
        approvalPolicy: "any_one",
        timeoutMinutes: 30,
    }) as unknown as AuthorityRuleEntity

const RULE = {
    id: "rule-1",
    department: "sales",
    action: "refund",
    mode: "ask",
    limit_vnd: 1000000,
    required_fields: ["order_id"],
    unit: "vnd",
    auto_max: 100000,
    ask_max: 900000,
    agents: ["agent-1"],
}

describe("authority rules mapper", () => {
    it("maps the rule an action gate reads", () => {
        expect(toRule(rowOf())).toEqual(RULE)
    })

    it("maps the stored rule record", () => {
        expect(toRuleRecord(rowOf())).toEqual({
            ...RULE,
            workspace_id: "ws-1",
            note: "careful",
            updated_at: "2026-03-02T09:00:00.000Z",
            approver_roles: ["owner"],
            approver_rooms: ["room-1"],
            approver_members: ["member-minh"],
            approval_policy: "any_one",
            timeout_minutes: 30,
        })
    })

    it("maps the approval setup", () => {
        expect(toApprovalSetup(rowOf())).toEqual({
            department: "sales",
            action: "refund",
            mode: "ask",
            unit: "vnd",
            auto_max: 100000,
            ask_max: 900000,
            group: { roles: ["owner"], rooms: ["room-1"], members: ["member-minh"] },
            policy: "any_one",
            timeout_minutes: 30,
            agents: ["agent-1"],
        })
    })
})
