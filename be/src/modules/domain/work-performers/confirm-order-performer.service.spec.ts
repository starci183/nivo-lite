import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentsService } from "@modules/domain/agents"
import { EvidenceService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import type { OptionalOrder } from "@modules/domain/orders"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { ConfirmOrderPerformerService } from "./confirm-order-performer.service"
import { PerformerKitService } from "./performer-kit.service"
import { PROMPT_WRITER } from "./work-performers.decorators"
import type { PromptWriter } from "./work-performers.port"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

const lead: LeadRecordRow = {
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "zalo",
    need: "tea",
    stage: "new",
    context_summary: null,
    phone: null,
    email: null,
    origin: "live",
}

const order: NonNullable<OptionalOrder> = {
    id: "order-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "DH-1",
    items: "tea",
    amount_vnd: 1500000,
    status: "draft",
    origin: "live",
    confirmed_by: null,
    confirmed_at: null,
    created_at: "2026-10-12T09:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
}

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "confirm_order",
    subject_type: "lead",
    subject_id: "lead-1",
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
    proposal: { summary: "Order", amount_vnd: 1500000, fields: { items: "tea", amount_vnd: 1500000 } },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

describe("ConfirmOrderPerformerService", () => {
    const build = async () => {
        const kit = mock<PerformerKitService>()
        kit.text.mockReturnValue("DH-1 for Lan")
        kit.money.mockReturnValue("1.500.000")
        const leads = mock<LeadRecordsService>()
        leads.require.mockResolvedValue(lead)
        const orders = mock<OrdersService>()
        orders.draft.mockResolvedValue(order)
        const moduleRef = await Test.createTestingModule({
            providers: [
                ConfirmOrderPerformerService,
                { provide: PerformerKitService, useValue: kit },
                { provide: OrdersService, useValue: orders },
                { provide: LeadRecordsService, useValue: leads },
                { provide: InboundEventsService, useValue: mock<InboundEventsService>() },
                { provide: AgentsService, useValue: mock<AgentsService>() },
                { provide: ResponsibilityJournalService, useValue: mock<ResponsibilityJournalService>() },
                { provide: PROMPT_WRITER, useValue: mock<PromptWriter>() },
                { provide: EvidenceService, useValue: mock<EvidenceService>() },
            ],
        }).compile()
        return moduleRef.get(ConfirmOrderPerformerService)
    }

    it("drafts the order from the proposal when the channel already named the amount", async () => {
        const service = await build()

        await expect(service.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: {
                summary: "DH-1 for Lan",
                amount_vnd: 1500000,
                fields: { customer: "Lan", items: "tea", amount_vnd: 1500000, order_no: "DH-1" },
            },
            patch: { subject_type: "order", subject_id: "order-1", lead_id: "lead-1" },
        })
    })
})
