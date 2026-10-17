import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { InvoiceAccountingRow } from "@modules/domain/invoices"
import type { TransactionAccountingRow } from "@modules/domain/transactions"
import type { AccountingBook, BookOrder } from "./accounting-book.contracts"
import { toAccountingBookView } from "./accounting-book-view.mapper"

const SUBJECT = Symbol("accounting-book-view.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toAccountingBookView } }],
    }).compile()
    return moduleRef.get<typeof import("./accounting-book-view.mapper")>(SUBJECT)
}

const expectedBook = {
    invoices: [
        {
            id: "invoice-1",
            workspaceId: "workspace-1",
            orderId: "order-1",
            leadId: "lead-1",
            invoiceNo: "INV-1",
            amountVnd: 120000,
            status: "paid",
            origin: "live",
            issuedBy: "Lan",
            paidAt: "2026-10-14T11:00:00Z",
            issuedAt: "2026-10-12T10:00:00Z",
            dueAt: "2026-10-15T10:00:00Z",
            createdAt: "2026-10-12T09:00:00Z",
            order: { orderNo: "SO-1", items: "Tea", amountVnd: 120000, status: "paid" },
            lead: { contactName: "Mai", company: "Mai Bakery" },
        },
    ],
    transactions: [
        {
            id: "transaction-1",
            workspaceId: "workspace-1",
            inboundEventId: "inbound-1",
            amountVnd: 120000,
            reference: "INV-1 payment",
            payer: "Mai",
            invoiceId: "invoice-1",
            status: "matched",
            origin: "live",
            channel: "bank",
            occurredAt: "2026-10-14T10:00:00Z",
            createdAt: "2026-10-14T10:01:00Z",
            inbound: { channel: "bank", eventId: "bank-1", body: "Payment received", senderName: "Mai" },
        },
    ],
    orders: [
        {
            id: "order-1",
            workspaceId: "workspace-1",
            leadId: "lead-1",
            inboundEventId: "inbound-2",
            orderNo: "SO-1",
            items: "Tea",
            amountVnd: 120000,
            status: "paid",
            origin: "live",
            confirmedBy: "Lan",
            confirmedAt: "2026-10-12T08:00:00Z",
            createdAt: "2026-10-12T07:00:00Z",
            shippedAt: "2026-10-13T08:00:00Z",
            carrier: "Carrier",
            trackingCode: "TRACK-1",
            lead: { contactName: "Mai", company: "Mai Bakery" },
        },
    ],
    works: [
        {
            id: "work-1",
            action: "accounting.reconcile",
            status: "done",
            subjectType: "transaction",
            subjectId: "transaction-1",
            createdAt: "2026-10-14T10:02:00Z",
        },
    ],
    decisions: [
        {
            id: "decision-1",
            workItemId: "work-1",
            action: "accounting.reconcile",
            decidedBy: "Lan",
            deciderKind: "staff",
            outcome: "approved",
            note: "Verified bank transfer",
            createdAt: "2026-10-14T10:03:00Z",
        },
    ],
    adjustments: [
        {
            id: "adjustment-1",
            targetType: "invoice",
            targetId: "invoice-1",
            note: "Amount corrected",
            correctedAmount: 120000,
            createdBy: "Lan",
            createdAt: "2026-10-14T10:04:00Z",
        },
    ],
    adjustmentsReady: true,
}

const invoiceOf = builder<InvoiceAccountingRow>({
    id: "invoice-1",
    workspace_id: "workspace-1",
    order_id: "order-1",
    lead_id: "lead-1",
    invoice_no: "INV-1",
    amount_vnd: 120000,
    status: "paid",
    origin: "live",
    issued_by: "Lan",
    paid_at: "2026-10-14T11:00:00Z",
    issued_at: "2026-10-12T10:00:00Z",
    due_at: "2026-10-15T10:00:00Z",
    created_at: "2026-10-12T09:00:00Z",
    order: { order_no: "SO-1", items: "Tea", amount_vnd: 120000, status: "paid" },
    lead: { contact_name: "Mai", company: "Mai Bakery" },
})

const transactionOf = builder<TransactionAccountingRow>({
    id: "transaction-1",
    workspace_id: "workspace-1",
    inbound_event_id: "inbound-1",
    amount_vnd: 120000,
    reference: "INV-1 payment",
    payer: "Mai",
    invoice_id: "invoice-1",
    status: "matched",
    origin: "live",
    channel: "bank",
    occurred_at: "2026-10-14T10:00:00Z",
    created_at: "2026-10-14T10:01:00Z",
    inbound: { channel: "bank", event_id: "bank-1", body: "Payment received", sender_name: "Mai" },
})

const orderOf = builder<BookOrder>({
    id: "order-1",
    workspace_id: "workspace-1",
    lead_id: "lead-1",
    inbound_event_id: "inbound-2",
    order_no: "SO-1",
    items: "Tea",
    amount_vnd: 120000,
    status: "paid",
    origin: "live",
    confirmed_by: "Lan",
    confirmed_at: "2026-10-12T08:00:00Z",
    created_at: "2026-10-12T07:00:00Z",
    shipped_at: "2026-10-13T08:00:00Z",
    carrier: "Carrier",
    tracking_code: "TRACK-1",
    contact_name: "Mai",
    company: "Mai Bakery",
    lead: { contact_name: "Mai", company: "Mai Bakery" },
})

describe("toAccountingBookView", () => {
    it("maps every owned record and its available evidence to the public book", async () => {
        const subject = await buildSubject()

        const book: AccountingBook = {
            invoices: [invoiceOf()],
            transactions: [transactionOf()],
            orders: [orderOf()],
            works: [
                {
                    id: "work-1",
                    action: "accounting.reconcile",
                    status: "done",
                    subject_type: "transaction",
                    subject_id: "transaction-1",
                    created_at: "2026-10-14T10:02:00Z",
                },
            ],
            decisions: [
                {
                    id: "decision-1",
                    work_item_id: "work-1",
                    action: "accounting.reconcile",
                    decided_by: "Lan",
                    decider_kind: "staff",
                    outcome: "approved",
                    note: "Verified bank transfer",
                    created_at: "2026-10-14T10:03:00Z",
                },
            ],
            adjustments: [
                {
                    id: "adjustment-1",
                    target_type: "invoice",
                    target_id: "invoice-1",
                    note: "Amount corrected",
                    corrected_amount_vnd: 120000,
                    created_by: "Lan",
                    created_at: "2026-10-14T10:04:00Z",
                },
            ],
            adjustmentsReady: true,
        }

        expect(subject.toAccountingBookView(book)).toEqual(expectedBook)
    })

    it("retains absent evidence relations and correction persistence readiness", async () => {
        const subject = await buildSubject()

        const view = subject.toAccountingBookView({
            invoices: [invoiceOf({ order: null, lead: null })],
            transactions: [transactionOf({ inbound: null })],
            orders: [orderOf({ lead: null })],
            works: [],
            decisions: [],
            adjustments: [],
            adjustmentsReady: false,
        })

        expect(view.invoices[0]?.order).toBeNull()
        expect(view.invoices[0]?.lead).toBeNull()
        expect(view.transactions[0]?.inbound).toBeNull()
        expect(view.orders[0]?.lead).toBeNull()
        expect(view.works).toEqual([])
        expect(view.decisions).toEqual([])
        expect(view.adjustments).toEqual([])
        expect(view.adjustmentsReady).toBe(false)
    })
})
