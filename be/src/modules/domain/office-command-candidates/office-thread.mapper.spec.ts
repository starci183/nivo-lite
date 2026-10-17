import { Test } from "@nestjs/testing"

import { builder } from "@starci/jest-preset"

import { toApprovalView } from "./office-thread.mapper"

import type { ApprovalRow } from "./persistence/office-thread.rows"

const POLICY = Symbol("./office-thread.mapper")

type PolicySubject = { toApprovalView: typeof toApprovalView }

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

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { toApprovalView } }],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(POLICY)

    return { subject }
}

describe("toApprovalView", () => {
    it("names the customer with the company and the agent by its own name", async () => {
        const { subject } = await buildSubject()

        expect(subject.toApprovalView(rowOf())).toEqual({
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

    it("uses the bare name without a company and none without a customer", async () => {
        const { subject } = await buildSubject()

        expect(subject.toApprovalView(rowOf({ company: null })).leadName).toBe("Lan")
        expect(subject.toApprovalView(rowOf({ company: "" })).leadName).toBe("Lan")
        expect(subject.toApprovalView(rowOf({ contact_name: null })).leadName).toBeNull()
    })

    it("falls back to the owner's name, then to nothing, and to empty channel and next action", async () => {
        const { subject } = await buildSubject()

        const bare = subject.toApprovalView(rowOf({ agent_name: null, channel: null, next_action: null }))
        expect(bare).toMatchObject({ agentName: "An", channel: "", nextAction: "" })
        expect(subject.toApprovalView(rowOf({ agent_name: null, owner_name: null })).agentName).toBeNull()
    })
})
