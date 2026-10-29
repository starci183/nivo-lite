import { builder } from "@starci/jest-preset"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import type { OptionalInboundEvent } from "@modules/domain/inbound-events"
import type { LeadRecordRow } from "@modules/domain/leads"
import type { OptionalOrder } from "@modules/domain/orders"

export const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

export const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "confirm_order",
    subject_type: "order",
    subject_id: "ord-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Order", fields: { items: "2 tea boxes", amount_vnd: 300000 } },
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

export const leadOf = builder<LeadRecordRow>({
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "Telegram",
    need: "tea",
    stage: "proposal",
    context_summary: null,
    phone: "84901234567",
    email: null,
})

export const orderOf = builder<NonNullable<OptionalOrder>>({
    id: "ord-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "SO-1",
    items: "2 tea boxes",
    amount_vnd: 300000,
    status: "draft",
    confirmed_by: null,
    confirmed_at: null,
    created_at: "2026-10-12T09:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
})

export const eventOf = builder<NonNullable<OptionalInboundEvent>>({
    id: "ev-1",
    workspace_id: "ws-1",
    channel: "telegram",
    kind: "order",
    sender_name: "Lan",
    sender_contact: "0901234567",
    body: " 2 boxes of tea please ",
    amount_vnd: null,
    external_ref: " REF-1 ",
    event_id: "tg:1",
    lead_id: null,
    status: "new",
})

/** A proposal of the proof with the given fields and an optional amount. */
export const proposalOf = (fields: Proposal["fields"], amount?: number | null): Proposal => ({
    summary: "Order",
    amount_vnd: amount,
    fields,
})
