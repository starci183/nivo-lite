import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { PerformerKitService } from "./performer-kit.service"
import { leadHref } from "./performer.policy"
import { ReplyCustomerPerformerService } from "./reply-customer-performer.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }
const proposal: Proposal = { summary: "Reply", draft: "Hello", fields: {} }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "reply_customer",
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
    proposal,
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "simulated",
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

describe("ReplyCustomerPerformerService", () => {
    const build = async () => {
        const kit = mock<PerformerKitService>()
        kit.text.mockReturnValue("simulated on website")
        const moduleRef = await Test.createTestingModule({
            providers: [
                ReplyCustomerPerformerService,
                { provide: PerformerKitService, useValue: kit },
                { provide: CustomerDeliveryService, useValue: mock<CustomerDeliveryService>() },
            ],
        }).compile()
        return moduleRef.get(ReplyCustomerPerformerService)
    }

    it("keeps the approved draft and records a simulated website delivery", async () => {
        const service = await build()

        await expect(service.perform(ctx, itemOf(), proposal)).resolves.toEqual({
            summary: "simulated on website",
            evidence: "captured",
            href: leadHref("lead-1"),
            lead_id: "lead-1",
            detail: "Hello",
        })
    })

    it("hands back the proposal that was already prepared", async () => {
        const service = await build()

        await expect(service.prepare(ctx, itemOf())).resolves.toEqual({ proposal })
    })
})
