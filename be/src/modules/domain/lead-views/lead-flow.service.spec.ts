import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EvidenceService } from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import type { LeadView } from "@modules/domain/leads"
import { LeadReadService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { StaffDirectoryService } from "@modules/domain/staff"
import { TransactionsService } from "@modules/domain/transactions"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkItemsService } from "@modules/domain/work-items"
import type { WorkItem } from "@modules/domain/work-items"
import type { OrdersWorkbenchRow } from "@modules/domain/orders"
import type { InvoiceViewRow } from "@modules/domain/invoices"
import type { LeadFlowRecords } from "./lead-flow-view.contracts"
import { LeadFlowService } from "./lead-flow.service"

const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
}

const LEAD: LeadView = {
    id: "lead-1",
    contact_name: "Lan",
    company: "Shop",
    channel: "zalo",
    need: "menu",
    stage: "new",
    context_summary: null,
    installation_id: null,
    created_at: "2026-10-12T00:00:00.000Z",
}

const ITEM: WorkItem = {
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "issue_invoice",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Issue invoice", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: "staff-1",
    execution_id: null,
    created_at: "2026-10-12T00:00:00.000Z",
    updated_at: "2026-10-12T00:00:00.000Z",
    completed_at: null,
    installation_id: null,
}

const ORDER: OrdersWorkbenchRow = {
    id: "order-late",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "ORD-1",
    items: "Menu",
    amount_vnd: 120000,
    status: "confirmed",
    confirmed_by: "An",
    confirmed_at: "2026-10-12T00:00:00.000Z",
    created_at: "2026-10-13T00:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
}

const INVOICE: InvoiceViewRow = {
    id: "invoice-1",
    workspace_id: "ws-1",
    order_id: "order-late",
    lead_id: "lead-1",
    invoice_no: "INV-1",
    amount_vnd: 120000,
    status: "issued",
    issued_by: "An",
    due_at: null,
    issued_at: "2026-10-12T00:00:00.000Z",
    paid_at: null,
    created_at: "2026-10-12T00:00:00.000Z",
}

const buildWithDoubles = async (records: Partial<LeadFlowRecords> = {}) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const leads = mock<LeadReadService>()
    leads.require.mockResolvedValue(LEAD)
    const workItems = mock<WorkItemsService>()
    workItems.listForLead.mockResolvedValue([...(records.workItems ?? [])])
    const orders = mock<OrdersService>()
    orders.listForLead.mockResolvedValue([...(records.orders ?? [])])
    const invoices = mock<InvoicesService>()
    invoices.listForLead.mockResolvedValue([...(records.invoices ?? [])])
    const transactions = mock<TransactionsService>()
    transactions.listForInvoices.mockResolvedValue([...(records.transactions ?? [])])
    const evidence = mock<EvidenceService>()
    evidence.listDecisions.mockResolvedValue([...(records.decisions ?? [])])
    const staff = mock<StaffDirectoryService>()
    staff.namesOf.mockResolvedValue([...(records.staff ?? [])])
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFlowService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: LeadReadService, useValue: leads },
            { provide: WorkItemsService, useValue: workItems },
            { provide: OrdersService, useValue: orders },
            { provide: InvoicesService, useValue: invoices },
            { provide: TransactionsService, useValue: transactions },
            { provide: EvidenceService, useValue: evidence },
            { provide: StaffDirectoryService, useValue: staff },
        ],
    }).compile()
    return {
        service: moduleRef.get(LeadFlowService),
        members,
        leads,
        workItems,
        orders,
        invoices,
        transactions,
        evidence,
        staff,
    }
}

const build = async () => (await buildWithDoubles()).service

describe("LeadFlowService", () => {
    it("returns an empty journey after proving the caller belongs to the workspace", async () => {
        const service = await build()

        await expect(service.read("user-1", "ws-1", "lead-1")).resolves.toEqual({
            workItems: [],
            orders: [],
            invoices: [],
            transactions: [],
            decisions: [],
        })
    })
})

describe("LeadFlowService", () => {
    it("reads owner records, deduplicates staff and orders the customer's journey by creation time and id", async () => {
        const records: Partial<LeadFlowRecords> = {
            workItems: [ITEM, { ...ITEM, id: "item-2" }, { ...ITEM, id: "item-3", assigned_staff_id: null }],
            orders: [
                ORDER,
                { ...ORDER, id: "order-b", created_at: "2026-10-12T00:00:00.000Z" },
                { ...ORDER, id: "order-a", created_at: "2026-10-12T00:00:00.000Z" },
            ],
            invoices: [INVOICE, { ...INVOICE, id: "invoice-2" }],
            staff: [{ id: "staff-1", name: "An" }],
            transactions: [
                {
                    id: "transaction-1",
                    workspace_id: "ws-1",
                    inbound_event_id: null,
                    channel: "bank",
                    amount_vnd: 120000,
                    reference: "INV-1",
                    payer: "Lan",
                    occurred_at: "2026-10-13T00:00:00.000Z",
                    invoice_id: "invoice-1",
                    status: "matched",
                    created_at: "2026-10-13T00:00:00.000Z",
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
                    decider_kind: "owner",
                    outcome: "approved",
                    reason: "routine",
                    note: null,
                    created_at: "2026-10-12T00:00:00.000Z",
                },
            ],
        }
        const { service, members, leads, workItems, orders, invoices, transactions, evidence, staff } =
            await buildWithDoubles(records)

        const result = await service.read("user-1", "ws-1", "lead-1")

        expect(result).toMatchObject({
            workItems: [
                { id: "item-1", assignedStaffName: "An", lead: { id: "lead-1", contactName: "Lan" } },
                { id: "item-2", assignedStaffName: "An" },
                { id: "item-3", assignedStaffId: null, assignedStaffName: null },
            ],
            orders: [{ id: "order-a" }, { id: "order-b" }, { id: "order-late" }],
            invoices: [{ id: "invoice-1" }, { id: "invoice-2" }],
            transactions: [{ id: "transaction-1", invoiceId: "invoice-1", amountVnd: 120000 }],
            decisions: [{ id: "decision-1", workItemId: "item-1", decidedBy: "An" }],
        })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(leads.require).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(workItems.listForLead).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(orders.listForLead).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(invoices.listForLead).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(evidence.listDecisions).toHaveBeenCalledWith("ws-1", { leadId: "lead-1", limit: 500, oldestFirst: true })
        expect(transactions.listForInvoices).toHaveBeenCalledWith("ws-1", ["invoice-1", "invoice-2"])
        expect(staff.namesOf).toHaveBeenCalledWith("ws-1", ["staff-1"])
    })
})

describe("LeadFlowService", () => {
    it("refuses a nonmember before reading the lead or any journey records", async () => {
        const { service, members, leads, workItems, orders, invoices, transactions, evidence, staff } =
            await buildWithDoubles()
        const denied = { code: "WORKSPACE_MEMBERS_NOT_MEMBER", params: { workspaceId: "ws-1" } }
        members.require.mockRejectedValue(denied)

        await expect(service.read("outsider", "ws-1", "lead-1")).rejects.toEqual(denied)

        expect(members.require).toHaveBeenCalledWith("outsider", "ws-1")
        expect(leads.require).not.toHaveBeenCalled()
        expect(workItems.listForLead).not.toHaveBeenCalled()
        expect(orders.listForLead).not.toHaveBeenCalled()
        expect(invoices.listForLead).not.toHaveBeenCalled()
        expect(transactions.listForInvoices).not.toHaveBeenCalled()
        expect(evidence.listDecisions).not.toHaveBeenCalled()
        expect(staff.namesOf).not.toHaveBeenCalled()
    })

    it("refuses a missing lead before reading the journey records", async () => {
        const { service, members, leads, workItems, orders, invoices, transactions, evidence, staff } =
            await buildWithDoubles()
        const missing = { code: "LEADS_NOT_FOUND", params: { id: "foreign-lead" } }
        leads.require.mockRejectedValue(missing)

        await expect(service.read("user-1", "ws-1", "foreign-lead")).rejects.toEqual(missing)

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(leads.require).toHaveBeenCalledWith("ws-1", "foreign-lead")
        expect(workItems.listForLead).not.toHaveBeenCalled()
        expect(orders.listForLead).not.toHaveBeenCalled()
        expect(invoices.listForLead).not.toHaveBeenCalled()
        expect(transactions.listForInvoices).not.toHaveBeenCalled()
        expect(evidence.listDecisions).not.toHaveBeenCalled()
        expect(staff.namesOf).not.toHaveBeenCalled()
    })
})
