import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { WorkspaceMailService } from "@modules/domain/email-messages"
import { WorkspacesService } from "@modules/domain/workspaces"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PerformerKitService } from "./performer-kit.service"
import { SendEmailPerformerService } from "./send-email-performer.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }
const proposal: Proposal = { summary: "Receipt", draft: "Paid", fields: {} }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_email",
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

describe("SendEmailPerformerService", () => {
    const build = async () => {
        const kit = mock<PerformerKitService>()
        kit.text.mockReturnValue("simulated email")
        const moduleRef = await Test.createTestingModule({
            providers: [
                SendEmailPerformerService,
                { provide: LOGGER, useValue: mock<Logger>() },
                { provide: PerformerKitService, useValue: kit },
                { provide: WorkspaceMailService, useValue: mock<WorkspaceMailService>() },
                { provide: WorkspacesService, useValue: mock<WorkspacesService>() },
            ],
        }).compile()
        return moduleRef.get(SendEmailPerformerService)
    }

    it("records a simulated email without sending it", async () => {
        const service = await build()

        await expect(service.perform(ctx, itemOf(), proposal)).resolves.toEqual({
            summary: "simulated email",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "Paid",
        })
    })

    it("hands back the proposal that was already prepared", async () => {
        const service = await build()

        await expect(service.prepare(ctx, itemOf())).resolves.toEqual({ proposal })
    })
})
