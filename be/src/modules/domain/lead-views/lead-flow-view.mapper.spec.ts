import { Test } from "@nestjs/testing"
import type { WorkItem } from "@modules/domain/work-items"
import type { LeadFlowRecords } from "./lead-flow-view.contracts"
import { toLeadFlowView } from "./lead-flow-view.mapper"
const SUBJECT = Symbol("lead-flow-view.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toLeadFlowView } }],
    }).compile()
    return moduleRef.get<typeof import("./lead-flow-view.mapper")>(SUBJECT)
}

const ITEM: WorkItem = {
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "issue_invoice",
    subject_type: "order",
    subject_id: "order-1",
    lead_id: "lead-1",
    inbound_event_id: "event-1",
    parent_id: "parent-1",
    chain_id: "chain-1",
    depth: 2,
    status: "done",
    decided_path: "human",
    reason: "routine",
    reasons: ["routine"],
    missing_fields: ["reference"],
    proposal: {
        summary: "Invoice the order",
        draft: "",
        amount_vnd: 0,
        fields: { note: "Paid", amount: 0, reference: null },
        confidence: 0,
        outcome: "unclear",
        candidates: [{ id: "invoice-1", label: "First invoice", amount_vnd: 120000 }],
    },
    result: { summary: "Invoice issued", href: "/invoices/invoice-1" },
    error: "Previous attempt failed",
    evidence_state: "verified",
    assigned_staff_id: "staff-1",
    execution_id: "execution-1",
    origin: "simulated",
    created_at: "2026-10-12T01:00:00.000Z",
    updated_at: "2026-10-12T02:00:00.000Z",
    completed_at: "2026-10-12T02:00:00.000Z",
    installation_id: "installation-1",
}

const RECORDS: LeadFlowRecords = {
    workItems: [ITEM],
    lead: {
        id: "lead-1",
        contact_name: "Lan",
        company: "Shop",
        channel: "Zalo",
        need: "menu",
        stage: "won",
        context_summary: null,
        origin: "simulated",
        installation_id: "installation-1",
        created_at: "2026-10-12T00:00:00.000Z",
    },
    staff: [
        { id: "staff-other", name: "Binh" },
        { id: "staff-1", name: "An" },
    ],
    orders: [
        {
            id: "order-1",
            workspace_id: "ws-1",
            lead_id: "lead-1",
            inbound_event_id: "event-1",
            order_no: "ORD-1",
            items: "Annual menu",
            amount_vnd: 120000,
            status: "paid",
            origin: "simulated",
            confirmed_by: "An",
            confirmed_at: "2026-10-12T01:00:00.000Z",
            created_at: "2026-10-12T00:00:00.000Z",
            shipped_at: "2026-10-13T00:00:00.000Z",
            carrier: "Carrier",
            tracking_code: "TRACK-1",
        },
    ],
    invoices: [
        {
            id: "invoice-1",
            workspace_id: "ws-1",
            order_id: "order-1",
            lead_id: "lead-1",
            invoice_no: "INV-1",
            amount_vnd: 120000,
            due_at: "2026-10-19T00:00:00.000Z",
            status: "paid",
            origin: "simulated",
            issued_by: "An",
            issued_at: "2026-10-12T02:00:00.000Z",
            paid_at: "2026-10-12T03:00:00.000Z",
            created_at: "2026-10-12T02:00:00.000Z",
        },
    ],
    transactions: [
        {
            id: "transaction-1",
            workspace_id: "ws-1",
            inbound_event_id: "payment-event-1",
            channel: "bank",
            amount_vnd: 120000,
            reference: "INV-1",
            payer: "Lan",
            occurred_at: "2026-10-12T03:00:00.000Z",
            invoice_id: "invoice-1",
            status: "matched",
            origin: "simulated",
            created_at: "2026-10-12T04:00:00.000Z",
        },
    ],
    decisions: [
        {
            id: "decision-1",
            work_item_id: "item-1",
            lead_id: "lead-1",
            leadName: "Lan",
            department: "sales",
            action: "issue_invoice",
            decided_by: "An",
            decider_kind: "staff",
            outcome: "approved",
            reason: "routine",
            note: "Approved invoice",
            created_at: "2026-10-12T02:00:00.000Z",
        },
    ],
}

const EXPECTED_VIEW = {
    workItems: [
        {
            id: "item-1",
            workspaceId: "ws-1",
            department: "sales",
            action: "issue_invoice",
            subjectType: "order",
            subjectId: "order-1",
            leadId: "lead-1",
            inboundEventId: "event-1",
            parentId: "parent-1",
            chainId: "chain-1",
            depth: 2,
            status: "done",
            decidedPath: "human",
            reason: "routine",
            reasons: ["routine"],
            missingFields: ["reference"],
            proposal: {
                summary: "Invoice the order",
                draft: "",
                amountVnd: 0,
                fields: [
                    { key: "note", kind: "string", stringValue: "Paid", numberValue: null },
                    { key: "amount", kind: "number", stringValue: null, numberValue: 0 },
                    { key: "reference", kind: "null", stringValue: null, numberValue: null },
                ],
                confidence: 0,
                outcome: "unclear",
                candidates: [{ id: "invoice-1", label: "First invoice", amountVnd: 120000 }],
            },
            result: { summary: "Invoice issued", href: "/invoices/invoice-1" },
            error: "Previous attempt failed",
            evidenceState: "verified",
            assignedStaffId: "staff-1",
            executionId: "execution-1",
            origin: "simulated",
            createdAt: "2026-10-12T01:00:00.000Z",
            updatedAt: "2026-10-12T02:00:00.000Z",
            completedAt: "2026-10-12T02:00:00.000Z",
            installationId: "installation-1",
            lead: { id: "lead-1", contactName: "Lan", company: "Shop", channel: "Zalo" },
            assignedStaffName: "An",
            hasApprovalCard: true,
            href: "/leads/lead-1",
            decidedBy: null,
        },
    ],
    orders: [
        {
            id: "order-1",
            workspaceId: "ws-1",
            leadId: "lead-1",
            inboundEventId: "event-1",
            orderNo: "ORD-1",
            items: "Annual menu",
            amountVnd: 120000,
            status: "paid",
            origin: "simulated",
            confirmedBy: "An",
            confirmedAt: "2026-10-12T01:00:00.000Z",
            createdAt: "2026-10-12T00:00:00.000Z",
            shippedAt: "2026-10-13T00:00:00.000Z",
            carrier: "Carrier",
            trackingCode: "TRACK-1",
        },
    ],
    invoices: [
        {
            id: "invoice-1",
            workspaceId: "ws-1",
            orderId: "order-1",
            leadId: "lead-1",
            invoiceNo: "INV-1",
            amountVnd: 120000,
            dueAt: "2026-10-19T00:00:00.000Z",
            status: "paid",
            origin: "simulated",
            issuedBy: "An",
            issuedAt: "2026-10-12T02:00:00.000Z",
            paidAt: "2026-10-12T03:00:00.000Z",
            createdAt: "2026-10-12T02:00:00.000Z",
        },
    ],
    transactions: [
        {
            id: "transaction-1",
            workspaceId: "ws-1",
            inboundEventId: "payment-event-1",
            channel: "bank",
            amountVnd: 120000,
            reference: "INV-1",
            payer: "Lan",
            occurredAt: "2026-10-12T03:00:00.000Z",
            invoiceId: "invoice-1",
            status: "matched",
            origin: "simulated",
            createdAt: "2026-10-12T04:00:00.000Z",
        },
    ],
    decisions: [
        {
            id: "decision-1",
            workItemId: "item-1",
            leadId: "lead-1",
            leadName: "Lan",
            department: "sales",
            action: "issue_invoice",
            decidedBy: "An",
            deciderKind: "staff",
            outcome: "approved",
            reason: "routine",
            note: "Approved invoice",
            createdAt: "2026-10-12T02:00:00.000Z",
        },
    ],
}

describe("toLeadFlowView", () => {
    it("maps the complete journey and preserves zero and empty proposal values", async () => {
        const subject = await build()

        const view = subject.toLeadFlowView(RECORDS)

        expect(view).toEqual(EXPECTED_VIEW)
        expect(view.workItems[0]?.reasons).not.toBe(ITEM.reasons)
        expect(view.workItems[0]?.missingFields).not.toBe(ITEM.missing_fields)
    })
})

describe("toLeadFlowView", () => {
    it("defaults optional proposal details and distinguishes absent results from results without links", async () => {
        const subject = await build()

        const view = subject.toLeadFlowView({
            ...RECORDS,
            workItems: [
                {
                    ...ITEM,
                    id: "unassigned",
                    assigned_staff_id: null,
                    execution_id: null,
                    proposal: { summary: "Awaiting details", fields: {} },
                    result: null,
                },
                {
                    ...ITEM,
                    id: "unknown-staff",
                    assigned_staff_id: "staff-missing",
                    proposal: { summary: "No amount", amount_vnd: null, fields: {} },
                    result: { summary: "Recorded" },
                },
            ],
        })

        expect(view.workItems[0]).toMatchObject({
            id: "unassigned",
            assignedStaffId: null,
            assignedStaffName: null,
            executionId: null,
            hasApprovalCard: false,
            proposal: {
                summary: "Awaiting details",
                draft: null,
                amountVnd: null,
                fields: [],
                confidence: null,
                outcome: null,
                candidates: [],
            },
            result: null,
        })
        expect(view.workItems[1]).toMatchObject({
            id: "unknown-staff",
            assignedStaffId: "staff-missing",
            assignedStaffName: null,
            proposal: {
                summary: "No amount",
                draft: null,
                amountVnd: null,
                fields: [],
                confidence: null,
                outcome: null,
                candidates: [],
            },
            result: { summary: "Recorded", href: null },
        })
    })
})
