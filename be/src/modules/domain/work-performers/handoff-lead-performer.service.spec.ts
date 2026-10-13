import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentsService } from "@modules/domain/agents"
import { EvidenceService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { HandoffLeadPerformerService } from "./handoff-lead-performer.service"
import { PerformerKitService } from "./performer-kit.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "chatbot",
    action: "handoff_lead",
    subject_type: "conversation",
    subject_id: "conv-1",
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
    proposal: { summary: "old", fields: { contact_name: "Lan", need: "tea" } },
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

describe("HandoffLeadPerformerService", () => {
    const build = async () => {
        const kit = mock<PerformerKitService>()
        kit.text.mockReturnValue("Lan wants tea")
        const moduleRef = await Test.createTestingModule({
            providers: [
                HandoffLeadPerformerService,
                { provide: PerformerKitService, useValue: kit },
                { provide: LeadRecordsService, useValue: mock<LeadRecordsService>() },
                { provide: AgentsService, useValue: mock<AgentsService>() },
                { provide: AgentConversationsService, useValue: mock<AgentConversationsService>() },
                { provide: InboundEventsService, useValue: mock<InboundEventsService>() },
                { provide: ResponsibilityJournalService, useValue: mock<ResponsibilityJournalService>() },
                { provide: EvidenceService, useValue: mock<EvidenceService>() },
            ],
        }).compile()
        return moduleRef.get(HandoffLeadPerformerService)
    }

    it("writes the handoff summary from the captured name and need", async () => {
        const service = await build()
        const item = itemOf()

        await expect(service.prepare(ctx, item)).resolves.toEqual({
            proposal: { summary: "Lan wants tea", fields: { contact_name: "Lan", need: "tea" } },
        })
    })
})
