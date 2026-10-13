import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EvidenceService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { IssueInvoicePerformerService } from "./issue-invoice-performer.service"
import { PaymentInstructionsService } from "./payment-instructions.service"
import { PerformerKitService } from "./performer-kit.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "issue_invoice",
    subject_type: "lead",
    subject_id: "lead-1",
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
    proposal: { summary: "Invoice", fields: {} },
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

describe("IssueInvoicePerformerService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                IssueInvoicePerformerService,
                { provide: LOGGER, useValue: mock<Logger>() },
                { provide: PerformerKitService, useValue: mock<PerformerKitService>() },
                { provide: InvoicesService, useValue: mock<InvoicesService>() },
                { provide: OrdersService, useValue: mock<OrdersService>() },
                { provide: LeadRecordsService, useValue: mock<LeadRecordsService>() },
                { provide: PaymentInstructionsService, useValue: mock<PaymentInstructionsService>() },
                { provide: EvidenceService, useValue: mock<EvidenceService>() },
            ],
        }).compile()
        return moduleRef.get(IssueInvoicePerformerService)
    }

    it("refuses an invoice that is not for an order and names no customer", async () => {
        const service = await build()

        await expect(service.prepare(ctx, itemOf())).rejects.toMatchObject({
            code: WorkPerformersErrorCode.SubjectMissing,
        })
    })
})
