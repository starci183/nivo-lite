import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { InvoiceViewRow } from "@modules/domain/invoices"
import type { LeadView } from "@modules/domain/leads"
import type { OrdersWorkbenchRow } from "@modules/domain/orders"
import type { HandoffRow } from "./sales-workbench.contracts"
import type { WorkItemView } from "./work-item-view.contracts"
import { handoffsOf } from "./sales-handoffs.mapper"

const SUBJECT = Symbol("sales-handoffs.mapper")
type Subject = { handoffsOf: typeof handoffsOf }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { handoffsOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const orderOf = builder<OrdersWorkbenchRow>({
    id: "order-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "SO-1",
    items: "Tea",
    amount_vnd: 250000,
    status: "confirmed",
    confirmed_by: "Bao",
    confirmed_at: "2026-10-12T10:00:00.000Z",
    created_at: "2026-10-11T10:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
})

const invoiceOf = builder<InvoiceViewRow>({
    id: "invoice-1",
    workspace_id: "ws-1",
    order_id: "order-1",
    lead_id: "lead-1",
    invoice_no: "INV-1",
    amount_vnd: 250000,
    status: "issued",
    issued_by: "Mai",
    issued_at: "2026-10-12T11:00:00.000Z",
    due_at: null,
    paid_at: null,
    created_at: "2026-10-12T11:00:00.000Z",
})

const itemOf = builder<WorkItemView>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "issue_invoice",
    subject_type: "order",
    subject_id: "order-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "failed",
    decided_path: "auto",
    reason: "missing_data",
    reasons: ["missing_data"],
    missing_fields: ["amount_vnd"],
    proposal: { summary: "Invoice the order", fields: {} },
    result: null,
    error: "Amount missing",
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-12T10:30:00.000Z",
    updated_at: "2026-10-12T10:30:00.000Z",
    completed_at: null,
    installation_id: null,
    lead: null,
    assignedStaffName: null,
    hasApprovalCard: false,
    href: "/leads/lead-1",
})

const leadOf = builder<LeadView>({
    id: "lead-1",
    contact_name: "Lan",
    company: "Tea House",
    channel: "email",
    need: "Tea for the office",
    stage: "won",
    context_summary: null,
    installation_id: null,
    created_at: "2026-10-11T10:00:00.000Z",
})

const handoffOf = builder<HandoffRow>({
    key: "order:order-1",
    orderId: "order-1",
    leadId: "lead-1",
    customer: "Lan",
    orderNo: "SO-1",
    items: "Tea",
    amountVnd: 250000,
    orderStatus: "confirmed",
    confirmedAt: "2026-10-12T10:00:00.000Z",
    invoice: null,
    work: null,
    canHandoff: true,
    shippedAt: null,
    carrier: null,
    trackingCode: null,
    canShip: true,
})

describe("handoffsOf", () => {
    it("returns no rows when there are no orders or customers", async () => {
        const subject = await build()

        expect(
            subject.handoffsOf(
                { invoices: [], items: [], leads: [] },
                { orders: [], leadById: new Map(), quoteByLead: new Map(), closedByLead: new Map() },
            ),
        ).toEqual([])
    })

    it("uses the last non-void invoice and first invoice work while ignoring unrelated rows", async () => {
        const subject = await build()

        expect(
            subject.handoffsOf(
                {
                    invoices: [
                        invoiceOf(),
                        invoiceOf({ invoice_no: "INV-2", amount_vnd: 300000, status: "paid", paid_at: "paid-at" }),
                        invoiceOf({ invoice_no: "VOID", status: "void" }),
                        invoiceOf({ order_id: null, invoice_no: "UNLINKED" }),
                    ],
                    items: [
                        itemOf({ action: "send_quote" }),
                        itemOf({ subject_id: null }),
                        itemOf(),
                        itemOf({ id: "duplicate", status: "rejected" }),
                    ],
                    leads: [leadOf()],
                },
                {
                    orders: [orderOf()],
                    leadById: new Map([["lead-1", leadOf()]]),
                    quoteByLead: new Map(),
                    closedByLead: new Map(),
                },
            ),
        ).toEqual([
            handoffOf({
                invoice: {
                    no: "INV-2",
                    status: "paid",
                    amountVnd: 300000,
                    issuedAt: "2026-10-12T11:00:00.000Z",
                    paidAt: "paid-at",
                },
                work: { id: "item-1", status: "failed", reason: "missing_data", error: "Amount missing" },
                canHandoff: false,
            }),
        ])
    })
})

describe("handoffsOf", () => {
    it("allows confirmed orders without active work and carries shipment state for the other orders", async () => {
        const subject = await build()

        expect(
            subject.handoffsOf(
                {
                    invoices: [],
                    items: [
                        itemOf({ subject_id: "retry", status: "rejected", reason: "not_allowed", error: null }),
                        itemOf({ subject_id: "active", status: "queued", reason: null, error: null }),
                    ],
                    leads: [],
                },
                {
                    orders: [
                        orderOf(),
                        orderOf({ id: "retry" }),
                        orderOf({ id: "active" }),
                        orderOf({ id: "draft", lead_id: null, status: "draft", confirmed_at: null }),
                        orderOf({
                            id: "paid",
                            status: "paid",
                            shipped_at: "2026-10-13T09:00:00.000Z",
                            carrier: "Courier",
                            tracking_code: "TRACK-1",
                        }),
                        orderOf({ id: "invoiced", lead_id: "deleted", status: "invoiced" }),
                    ],
                    leadById: new Map([["lead-1", leadOf()]]),
                    quoteByLead: new Map(),
                    closedByLead: new Map(),
                },
            ),
        ).toEqual([
            handoffOf(),
            handoffOf({
                key: "order:retry",
                orderId: "retry",
                work: { id: "item-1", status: "rejected", reason: "not_allowed", error: null },
            }),
            handoffOf({
                key: "order:active",
                orderId: "active",
                work: { id: "item-1", status: "queued", reason: null, error: null },
                canHandoff: false,
            }),
            handoffOf({
                key: "order:paid",
                orderId: "paid",
                orderStatus: "paid",
                canHandoff: false,
                shippedAt: "2026-10-13T09:00:00.000Z",
                carrier: "Courier",
                trackingCode: "TRACK-1",
                canShip: false,
            }),
            handoffOf({
                key: "order:invoiced",
                orderId: "invoiced",
                leadId: "deleted",
                customer: "—",
                orderStatus: "invoiced",
                canHandoff: false,
            }),
            handoffOf({
                key: "order:draft",
                orderId: "draft",
                leadId: null,
                customer: "—",
                orderStatus: "draft",
                confirmedAt: null,
                canHandoff: false,
                canShip: false,
            }),
        ])
    })
})

describe("handoffsOf", () => {
    it("adds only won customers without orders and sorts newest confirmations before missing dates", async () => {
        const subject = await build()

        expect(
            subject.handoffsOf(
                {
                    invoices: [],
                    items: [itemOf({ id: "lead-work", subject_id: "won-priced", subject_type: "lead" })],
                    leads: [
                        leadOf({ id: "open", stage: "proposal" }),
                        leadOf(),
                        leadOf({ id: "won-undated", contact_name: "Mai", need: "Coffee" }),
                        leadOf({ id: "won-priced", contact_name: "Bao", need: "Cocoa" }),
                    ],
                },
                {
                    orders: [orderOf({ confirmed_at: null })],
                    leadById: new Map([["lead-1", leadOf()]]),
                    quoteByLead: new Map([["won-priced", 0]]),
                    closedByLead: new Map([["won-priced", { reason: "Accepted", at: "2026-10-13T10:00:00.000Z" }]]),
                },
            ),
        ).toEqual([
            handoffOf({
                key: "lead:won-priced",
                orderId: null,
                leadId: "won-priced",
                customer: "Bao",
                orderNo: null,
                items: "Cocoa",
                amountVnd: 0,
                orderStatus: "won_without_order",
                confirmedAt: "2026-10-13T10:00:00.000Z",
                work: { id: "lead-work", status: "failed", reason: "missing_data", error: "Amount missing" },
                canHandoff: false,
                canShip: false,
            }),
            handoffOf({ confirmedAt: null }),
            handoffOf({
                key: "lead:won-undated",
                orderId: null,
                leadId: "won-undated",
                customer: "Mai",
                orderNo: null,
                items: "Coffee",
                amountVnd: null,
                orderStatus: "won_without_order",
                confirmedAt: null,
                canHandoff: false,
                canShip: false,
            }),
        ])
    })
})
