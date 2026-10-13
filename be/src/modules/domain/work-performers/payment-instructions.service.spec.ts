import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentsService } from "@modules/domain/agents"
import { EvidenceService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import type { InvoiceRow } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { PaymentInstructionsService } from "./payment-instructions.service"
import { PerformerKitService } from "./performer-kit.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "issue_invoice",
    subject_type: "invoice",
    subject_id: "inv-1",
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
    proposal: { summary: "Pay", fields: {} },
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

const invoice: InvoiceRow = {
    id: "inv-1",
    workspace_id: "ws-1",
    order_id: null,
    lead_id: null,
    invoice_no: "HD-1",
    amount_vnd: 1500000,
    status: "issued",
    origin: "live",
    issued_by: null,
    paid_at: null,
}

describe("PaymentInstructionsService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                PaymentInstructionsService,
                { provide: PerformerKitService, useValue: mock<PerformerKitService>() },
                { provide: AgentConversationsService, useValue: mock<AgentConversationsService>() },
                { provide: AgentsService, useValue: mock<AgentsService>() },
                { provide: LeadRecordsService, useValue: mock<LeadRecordsService>() },
                { provide: OrdersService, useValue: mock<OrdersService>() },
                { provide: CustomerDeliveryService, useValue: mock<CustomerDeliveryService>() },
                { provide: EvidenceService, useValue: mock<EvidenceService>() },
            ],
        }).compile()
        return moduleRef.get(PaymentInstructionsService)
    }

    it("sends nothing when the invoice has no customer", async () => {
        const service = await build()

        await expect(service.send(ctx, itemOf(), invoice)).resolves.toBeNull()
    })
})
