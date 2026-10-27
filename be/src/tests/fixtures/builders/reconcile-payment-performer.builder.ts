import { builder } from "@starci/jest-preset"
import type { ContractResult } from "@modules/domain/contracts"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import type { OptionalInboundEvent } from "@modules/domain/inbound-events"
import type { InvoiceRow, InvoicesService } from "@modules/domain/invoices"
import type { LeadRecordsService } from "@modules/domain/leads"
import type { OptionalOrder } from "@modules/domain/orders"
import type { OptionalTransaction } from "@modules/domain/transactions"

/** One issued invoice as the invoices capability lists it. */
export type IssuedInvoice = Awaited<ReturnType<InvoicesService["listIssued"]>>[number]

/** One lead as the lead records capability finds it. */
type LeadRecord = NonNullable<Awaited<ReturnType<LeadRecordsService["find"]>>>

/** The context of every reconcile case. */
export const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

/** A reconcile work item. */
export const itemOf = builder<WorkItem>({
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
export const transactionOf = builder<NonNullable<OptionalTransaction>>({
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
export const invoiceOf = builder<InvoiceRow>({
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

/** An issued invoice. */
export const issuedOf = builder<IssuedInvoice>({
    ...invoiceOf({ status: "issued", paid_at: null }),
    order_no: "SO-1",
    contact_name: "Lan",
})

/** The known customer of a paid invoice. */
export const leadOf = builder<LeadRecord>({
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Mai",
    company: "Tea",
    channel: "Zalo",
    need: "Tea",
    stage: "won",
    context_summary: null,
    phone: null,
    email: null,
})

/** The paid order of an invoice. */
export const orderOf = builder<NonNullable<OptionalOrder>>({
    id: "ord-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "SO-9",
    items: "Tea",
    amount_vnd: 450000,
    status: "paid",
    confirmed_by: "Lan",
    confirmed_at: null,
    created_at: "2026-10-12T09:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
})

/** A recorded bank credit. */
export const eventOf = builder<NonNullable<OptionalInboundEvent>>({
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
export const proposalOf = builder<Proposal>({
    summary: "Payment",
    amount_vnd: 450000,
    fields: { reference: "INV-1 Lan", match: "matchedByCodeAmount" },
    candidates: [{ id: "inv-1", label: "INV-1", amount_vnd: 450000 }],
})

/** A contract moved to its next term. */
export const renewedContract: ContractResult = {
    id: "contract-1",
    leadId: "lead-1",
    customerName: "Lan",
    plan: "Yearly",
    startsOn: "2027-01-01",
    endsOn: "2028-01-01",
    amountVnd: 450000,
    status: "active",
    note: "",
}
