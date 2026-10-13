import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { LeadRecordsService } from "@modules/domain/leads"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { QuotePerformerService } from "./quote-performer.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
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
    proposal: { summary: "Quote", fields: {} },
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

describe("QuotePerformerService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                QuotePerformerService,
                { provide: PerformerKitService, useValue: mock<PerformerKitService>() },
                { provide: LeadRecordsService, useValue: mock<LeadRecordsService>() },
                { provide: CustomerDeliveryService, useValue: mock<CustomerDeliveryService>() },
            ],
        }).compile()
        return moduleRef.get(QuotePerformerService)
    }

    it("refuses a quote that names no customer", async () => {
        const service = await build()

        await expect(service.prepare(ctx, itemOf({ lead_id: null }))).rejects.toMatchObject({
            code: WorkPerformersErrorCode.SubjectMissing,
        })
    })
})
