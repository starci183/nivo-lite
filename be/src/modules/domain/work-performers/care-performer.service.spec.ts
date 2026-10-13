import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { TransactionsService } from "@modules/domain/transactions"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { PROMPT_WRITER } from "./work-performers.decorators"
import type { PromptWriter } from "./work-performers.port"
import { CarePerformerService } from "./care-performer.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_care",
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
    proposal: { summary: "Thanks", fields: {} },
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

describe("CarePerformerService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                CarePerformerService,
                { provide: PerformerKitService, useValue: mock<PerformerKitService>() },
                { provide: LeadRecordsService, useValue: mock<LeadRecordsService>() },
                { provide: TransactionsService, useValue: mock<TransactionsService>() },
                { provide: InvoicesService, useValue: mock<InvoicesService>() },
                { provide: OrdersService, useValue: mock<OrdersService>() },
                { provide: PROMPT_WRITER, useValue: mock<PromptWriter>() },
                { provide: CustomerDeliveryService, useValue: mock<CustomerDeliveryService>() },
            ],
        }).compile()
        return moduleRef.get(CarePerformerService)
    }

    it("refuses a thank-you that names no customer", async () => {
        const service = await build()

        await expect(service.prepare(ctx, itemOf({ lead_id: null }))).rejects.toMatchObject({
            code: WorkPerformersErrorCode.SubjectMissing,
        })
    })
})
