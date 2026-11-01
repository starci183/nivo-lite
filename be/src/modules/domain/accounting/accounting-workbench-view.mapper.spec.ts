import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { AccountingWaitingWorkRow } from "@modules/domain/decisions"
import type { StaffRow } from "@modules/domain/staff"
import { buildAccountingWorkbench } from "./accounting-workbench.policy"
import { toAccountingWorkbenchView } from "./accounting-workbench-view.mapper"

const SUBJECT = Symbol("accounting-workbench-view.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toAccountingWorkbenchView } }],
    }).compile()
    return moduleRef.get<typeof import("./accounting-workbench-view.mapper")>(SUBJECT)
}

const expectedQuestions = [
    {
        group: "missing_data",
        item: {
            id: "work-1",
            workspaceId: "ws-1",
            department: "accounting",
            action: "issue_invoice",
            subjectType: "invoice",
            subjectId: "invoice-1",
            leadId: null,
            inboundEventId: null,
            parentId: null,
            chainId: null,
            depth: 0,
            status: "waiting_decision",
            decidedPath: null,
            reason: "missing_data",
            reasons: ["missing_data"],
            missingFields: ["customer"],
            proposal: {
                summary: "Issue payment record",
                draft: null,
                amountVnd: 120,
                confidence: null,
                outcome: null,
                fields: [
                    { name: "customer", text: "Mai", number: null },
                    { name: "amount", text: null, number: 120 },
                ],
                candidates: [],
            },
            result: null,
            error: null,
            evidenceState: "pending",
            assignedStaffId: "staff-1",
            assignedStaffName: "Hoa",
            executionId: null,
            createdAt: "2026-10-12T10:00:00.000Z",
            updatedAt: "2026-10-12T10:00:00.000Z",
            completedAt: null,
            installationId: null,
            lead: null,
        },
    },
]

const itemOf = builder<AccountingWaitingWorkRow>({
    id: "work-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "issue_invoice",
    subject_type: "invoice",
    subject_id: "invoice-1",
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "missing_data",
    reasons: ["missing_data"],
    missing_fields: ["customer"],
    proposal: { summary: "Issue payment record", amount_vnd: 120, fields: { customer: "Mai", amount: 120 } },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: "staff-1",
    assigned_staff_name: "Hoa",
    execution_id: null,
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: null,
    lead: null,
})
const STAFF: StaffRow = {
    id: "staff-1",
    workspace_id: "ws-1",
    name: "Hoa",
    role: "cashier",
    email: "hoa@example.test",
    active: false,
    created_at: "2026-10-01T00:00:00.000Z",
}

describe("toAccountingWorkbenchView", () => {
    it("retains workbench figures and groups while mapping question proposals and staff transport fields", async () => {
        const subject = await buildSubject()

        const item = itemOf()
        const data = buildAccountingWorkbench({
            book: {
                invoices: [],
                transactions: [],
                orders: [],
                works: [],
                decisions: [],
                adjustments: [],
                payables: [],
                adjustmentsReady: true,
            },
            now: new Date("2026-10-12T10:00:00.000Z"),
            exceptions: [item],
            staff: [STAFF],
            ownerName: "Lan",
            role: "owner",
            creditsSource: null,
            payablesSource: null,
            profile: null,
            today: "2026-10-12",
        })

        const view = subject.toAccountingWorkbenchView(data)

        expect(view).toEqual({
            ...data,
            questions: expectedQuestions,
            staff: [
                {
                    id: "staff-1",
                    workspaceId: "ws-1",
                    name: "Hoa",
                    role: "cashier",
                    email: "hoa@example.test",
                    active: false,
                    createdAt: "2026-10-01T00:00:00.000Z",
                },
            ],
        })
        expect(data.questions).toEqual([{ item, group: "missing_data" }])
        expect(data.staff).toEqual([STAFF])
    })
})
