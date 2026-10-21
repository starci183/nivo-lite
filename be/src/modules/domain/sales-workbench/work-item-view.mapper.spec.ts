import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { LeadView } from "@modules/domain/leads"
import type { WorkItem } from "@modules/domain/work-items"
import { viewOfWorkItem } from "./work-item-view.mapper"

const SUBJECT = Symbol("work-item-view.mapper")
type Subject = { viewOfWorkItem: typeof viewOfWorkItem }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { viewOfWorkItem } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: "event-1",
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "over_authority",
    reasons: ["over_authority"],
    missing_fields: [],
    proposal: { summary: "Quote for tea", fields: { items: "tea" }, amount_vnd: 250000 },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: "staff-1",
    execution_id: "execution-1",
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:01:00.000Z",
    completed_at: null,
    installation_id: "installation-1",
})

const leadOf = builder<LeadView>({
    id: "lead-1",
    contact_name: "Lan",
    company: "Tea House",
    channel: "email",
    need: "Tea for the office",
    stage: "proposal",
    context_summary: null,
    installation_id: "installation-1",
    created_at: "2026-10-11T10:00:00.000Z",
})

describe("viewOfWorkItem", () => {
    it("retains the item and adds the first matching customer and assigned person", async () => {
        const subject = await build()

        const item = itemOf({ department: "inventory", decidedBy: "staff-2", deciderName: "Mai" })

        expect(
            subject.viewOfWorkItem(
                item,
                [leadOf({ id: "unrelated" }), leadOf(), leadOf({ contact_name: "Duplicate" })],
                [
                    { id: "staff-2", name: "Mai" },
                    { id: "staff-1", name: "Bao" },
                    { id: "staff-1", name: "Duplicate" },
                ],
            ),
        ).toEqual({
            ...item,
            lead: { id: "lead-1", contact_name: "Lan", company: "Tea House", channel: "email" },
            assignedStaffName: "Bao",
            hasApprovalCard: true,
            href: "/leads/lead-1",
        })
    })

    it("keeps the lead navigation when the referenced customer and person are absent", async () => {
        const subject = await build()

        const item = itemOf({ lead_id: "deleted-lead", execution_id: null })

        expect(subject.viewOfWorkItem(item, [leadOf()], [{ id: "staff-2", name: "Mai" }])).toEqual({
            ...item,
            lead: null,
            assignedStaffName: null,
            hasApprovalCard: false,
            href: "/leads/deleted-lead",
        })
    })

    it.each([
        { department: "inventory", href: "/agents/inventory/workbench?tab=orders" },
        { department: "shifts", href: "/agents/shifts/workbench" },
        { department: "accounting", href: "/chat" },
    ])("routes customerless $department work to $href", async ({ department, href }) => {
        const subject = await build()

        const item = itemOf({ department, lead_id: null, assigned_staff_id: null, execution_id: null })

        expect(subject.viewOfWorkItem(item, [leadOf()], [{ id: "staff-1", name: "Bao" }])).toEqual({
            ...item,
            lead: null,
            assignedStaffName: null,
            hasApprovalCard: false,
            href,
        })
    })
})
