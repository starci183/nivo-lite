import { builder } from "@starci/jest-preset"
import { toApprovalView } from "./office-thread.mapper"
import type { ApprovalRow } from "./persistence/office-thread.rows"

const rowOf = builder<ApprovalRow>({
    id: "x-1",
    responsibility_id: "r-1",
    agent_id: "a-1",
    kind: "follow_up",
    draft: "Hello",
    status: "pending_approval",
    decided_by: null,
    work_item_id: "w-1",
    decided_at: null,
    created_at: "2026-10-12T10:00:00+00:00",
    lead_id: "l-1",
    next_action: "Call back",
    owner_name: "An",
    contact_name: "Lan",
    company: "ACME",
    channel: "zalo",
    agent_name: "Mai",
    assigned_staff_id: "s-1",
})

describe("toApprovalView", () => {
    it("names the customer with the company and the agent by its own name", () => {
        expect(toApprovalView(rowOf())).toEqual({
            id: "x-1",
            responsibility_id: "r-1",
            agent_id: "a-1",
            kind: "follow_up",
            draft: "Hello",
            status: "pending_approval",
            decided_by: null,
            decided_at: null,
            created_at: "2026-10-12T10:00:00+00:00",
            work_item_id: "w-1",
            leadName: "Lan - ACME",
            leadId: "l-1",
            channel: "zalo",
            agentName: "Mai",
            nextAction: "Call back",
            assignedStaffId: "s-1",
        })
    })

    it("uses the bare name without a company and none without a customer", () => {
        expect(toApprovalView(rowOf({ company: null })).leadName).toBe("Lan")
        expect(toApprovalView(rowOf({ company: "" })).leadName).toBe("Lan")
        expect(toApprovalView(rowOf({ contact_name: null })).leadName).toBeNull()
    })

    it("falls back to the owner's name, then to nothing, and to empty channel and next action", () => {
        const bare = toApprovalView(rowOf({ agent_name: null, channel: null, next_action: null }))
        expect(bare).toMatchObject({ agentName: "An", channel: "", nextAction: "" })
        expect(toApprovalView(rowOf({ agent_name: null, owner_name: null })).agentName).toBeNull()
    })
})
