import { builder } from "@starci/jest-preset"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import type { OptionalInboundEvent, InboundEventDetail } from "@modules/domain/inbound-events"
import type { InvoiceRow } from "@modules/domain/invoices"
import type { OptionalTransaction, TransactionRow } from "@modules/domain/transactions"

/** The context of every reconcile case. */
export const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

/** A reconcile work item. */
export const itemOf: (overrides?: Partial<WorkItem>) => WorkItem = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "reconcile_payment",
    subject_type: "transaction",
    subject_id: "tx-1",
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Payment", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

/** A bank transaction. */
export const transactionOf: (overrides?: Partial<TransactionRow>) => TransactionRow = builder<
    NonNullable<OptionalTransaction>
>({
    id: "tx-1",
    workspace_id: "ws-1",
    inbound_event_id: null,
    amount_vnd: 450000,
    reference: "INV-1 Lan",
    payer: "Lan",
    invoice_id: null,
    status: "unmatched",
})

/** A paid invoice. */
export const invoiceOf: (overrides?: Partial<InvoiceRow>) => InvoiceRow = builder<InvoiceRow>({
    id: "inv-1",
    workspace_id: "ws-1",
    order_id: "ord-1",
    lead_id: "lead-1",
    invoice_no: "INV-1",
    amount_vnd: 450000,
    status: "paid",
    issued_by: "Mai",
    paid_at: "2026-10-12T10:00:00.000Z",
    contract_id: null,
    period_ends_on: null,
})

/** A recorded bank credit. */
export const eventOf: (overrides?: Partial<InboundEventDetail>) => InboundEventDetail = builder<
    NonNullable<OptionalInboundEvent>
>({
    id: "ev-1",
    workspace_id: "ws-1",
    channel: "bank",
    kind: "payment",
    sender_name: null,
    sender_contact: null,
    body: "CK chuyen tien",
    amount_vnd: 300000,
    external_ref: null,
    event_id: "sepay:123",
    lead_id: null,
    status: "new",
})

/** A clear proposal. */
export const proposalOf: (overrides?: Partial<Proposal>) => Proposal = builder<Proposal>({
    summary: "Payment",
    amount_vnd: 450000,
    fields: { reference: "INV-1 Lan", match: "matchedByCodeAmount" },
    candidates: [{ id: "inv-1", label: "INV-1", amount_vnd: 450000 }],
})
