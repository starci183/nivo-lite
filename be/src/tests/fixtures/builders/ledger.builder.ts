import type { InvoiceAccountingRow } from "@modules/domain/invoices"
import type { TransactionAccountingRow } from "@modules/domain/transactions"
import type { buildLedger } from "@modules/domain/ledger"

/** The input accepted by the ledger capability's public function. */
type LedgerInput = Parameters<typeof buildLedger>[0]

/** The creation timestamp of the accounting fixtures. */
export const CREATED = "2026-10-01T00:00:00.000Z"

/** The invoice issue timestamp of the accounting fixtures. */
export const ISSUED = "2026-10-02T00:00:00.000Z"

/** The payment timestamp of the accounting fixtures. */
export const PAID = "2026-10-03T00:00:00.000Z"

/** Builds an issued invoice with per-case accounting evidence. */
export const invoice = (patch: Partial<InvoiceAccountingRow> = {}): InvoiceAccountingRow => ({
    id: "invoice-1",
    workspace_id: "workspace-1",
    order_id: null,
    lead_id: null,
    invoice_no: "INV-1",
    amount_vnd: 120000,
    status: "issued",
    issued_by: null,
    paid_at: null,
    issued_at: ISSUED,
    due_at: null,
    created_at: CREATED,
    order: null,
    lead: null,
    ...patch,
})

/** Builds a matched bank payment with per-case overrides. */
export const transaction = (patch: Partial<TransactionAccountingRow> = {}): TransactionAccountingRow => ({
    id: "tx-1",
    workspace_id: "workspace-1",
    inbound_event_id: null,
    amount_vnd: 120000,
    reference: "REF-1",
    payer: "An",
    invoice_id: null,
    status: "matched",
    channel: "bank",
    occurred_at: PAID,
    created_at: PAID,
    inbound: null,
    ...patch,
})

/** Builds the accounting input with empty evidence collections by default. */
export const input = (patch: Partial<LedgerInput> = {}): LedgerInput => ({
    invoices: [],
    transactions: [],
    works: [],
    decisions: [],
    adjustments: [],
    ...patch,
})

const firstPayment = {
    kind: "payment",
    title: "An",
    detail: "REF-1",
    at: "1970-01-01T00:00:00.000Z",
    status: "matched",
    amount: 120000,
}

const secondPayment = {
    kind: "payment",
    title: "REF-2",
    detail: "REF-2",
    at: PAID,
    status: "matched",
    amount: 30000,
}

const orderEvidence = {
    kind: "order",
    title: "ORDER-1",
    detail: "Services",
    at: null,
    status: "confirmed",
    amount: 150000,
}

export const invoiceEvidence = {
    kind: "invoice",
    title: "INV-1",
    detail: "An",
    at: ISSUED,
    status: "paid",
    amount: 120000,
}

const decisions = [
    {
        kind: "decision",
        title: "auto_match",
        detail: null,
        at: "invalid date",
        status: "auto_done",
        amount: null,
    },
    {
        kind: "decision",
        title: "approve",
        detail: "Owner / Verified",
        at: "1970-01-01T00:00:00.000Z",
        status: "approved",
        amount: null,
    },
    { kind: "decision", title: "confirm", detail: "Staff", at: PAID, status: "edited", amount: null },
]

export const invoiceAdjustments = [
    { kind: "adjustment", title: "Owner", detail: "Note only", at: ISSUED, status: null, amount: null },
    { kind: "adjustment", title: "Staff", detail: "Corrected", at: PAID, status: null, amount: 115000 },
]

export const transactionAdjustment = {
    kind: "adjustment",
    title: "Owner",
    detail: "Bank correction",
    at: PAID,
    status: null,
    amount: 119000,
}

export const settlementInput: LedgerInput = input({
    invoices: [
        invoice({
            status: "paid",
            paid_at: PAID,
            order_id: "invoice-1",
            order: { order_no: "ORDER-1", items: "Services", amount_vnd: 150000, status: "confirmed" },
            lead: { contact_name: "An", company: "Acme" },
        }),
    ],
    transactions: [
        transaction({ invoice_id: "invoice-1", occurred_at: "1970-01-01T00:00:00.000Z" }),
        transaction({
            id: "tx-2",
            invoice_id: "invoice-1",
            payer: null,
            reference: "REF-2",
            amount_vnd: 30000,
        }),
    ],
    works: [
        {
            id: "work-1",
            action: "auto_match",
            status: "done",
            subject_type: "invoice",
            subject_id: "invoice-1",
            created_at: CREATED,
        },
        {
            id: "work-2",
            action: "approve",
            status: "done",
            subject_type: "order",
            subject_id: "invoice-1",
            created_at: CREATED,
        },
        {
            id: "work-3",
            action: "confirm",
            status: "done",
            subject_type: "transaction",
            subject_id: "tx-1",
            created_at: CREATED,
        },
        {
            id: "work-empty",
            action: "confirm",
            status: "done",
            subject_type: "transaction",
            subject_id: "tx-2",
            created_at: CREATED,
        },
        {
            id: "work-unlinked",
            action: "confirm",
            status: "done",
            subject_type: "transaction",
            subject_id: null,
            created_at: CREATED,
        },
    ],
    decisions: [
        {
            id: "d-1",
            work_item_id: "work-1",
            action: "auto_match",
            decided_by: "NIVO",
            decider_kind: "policy",
            outcome: "auto_done",
            note: null,
            created_at: "invalid date",
        },
        {
            id: "d-2",
            work_item_id: "work-1",
            action: "approve",
            decided_by: "Owner",
            decider_kind: "owner",
            outcome: "approved",
            note: "Verified",
            created_at: "1970-01-01T00:00:00.000Z",
        },
        {
            id: "d-3",
            work_item_id: "work-3",
            action: "confirm",
            decided_by: "Staff",
            decider_kind: "staff",
            outcome: "edited",
            note: null,
            created_at: PAID,
        },
        {
            id: "d-unlinked",
            work_item_id: null,
            action: "approve",
            decided_by: "Owner",
            decider_kind: "owner",
            outcome: "approved",
            note: null,
            created_at: CREATED,
        },
    ],
    adjustments: [
        {
            id: "a-2",
            target_type: "invoice",
            target_id: "invoice-1",
            note: "Corrected",
            corrected_amount_vnd: 115000,
            created_by: "Staff",
            created_at: PAID,
        },
        {
            id: "a-1",
            target_type: "invoice",
            target_id: "invoice-1",
            note: "Note only",
            corrected_amount_vnd: null,
            created_by: "Owner",
            created_at: ISSUED,
        },
        {
            id: "a-tx",
            target_type: "transaction",
            target_id: "tx-1",
            note: "Bank correction",
            corrected_amount_vnd: 119000,
            created_by: "Owner",
            created_at: PAID,
        },
    ],
})

/** The complete settlement ledger in descending evidence timestamp order. */
export const settlementExpected = [
    {
        id: "tx:tx-2",
        targetType: "transaction",
        targetId: "tx-2",
        at: PAID,
        description: "REF-2",
        kind: "income",
        amount: 30000,
        status: "matched",
        linked: "INV-1",
        lineage: [orderEvidence, invoiceEvidence, secondPayment, ...decisions.slice(0, 2)],
        adjustmentCount: 0,
    },
    {
        id: "inv:invoice-1",
        targetType: "invoice",
        targetId: "invoice-1",
        at: ISSUED,
        description: "INV-1 / An",
        kind: "receivable",
        amount: 120000,
        status: "settled",
        linked: "ORDER-1",
        lineage: [orderEvidence, invoiceEvidence, firstPayment, secondPayment, ...decisions, ...invoiceAdjustments],
        adjustmentCount: 2,
    },
    {
        id: "tx:tx-1",
        targetType: "transaction",
        targetId: "tx-1",
        at: "1970-01-01T00:00:00.000Z",
        description: "An / REF-1",
        kind: "income",
        amount: 120000,
        status: "matched",
        linked: "INV-1",
        lineage: [orderEvidence, invoiceEvidence, firstPayment, ...decisions, transactionAdjustment],
        adjustmentCount: 1,
    },
]
