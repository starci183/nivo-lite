import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AutomationsService } from "@modules/domain/automations"
import { CommandBusService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkItemsService } from "@modules/domain/work-items"
import { LeadActionsErrorCode } from "./errors/lead-actions.error"
import { LeadActionFlowService } from "./lead-action-flow.service"
import type { LeadActionRunRow } from "./persistence/lead-actions.rows"

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

const run: LeadActionRunRow = {
    id: "run-1",
    workspace_id: "ws-1",
    requested_by: "user-1",
    action: "settle-won",
    input: { leadId: "lead-1" },
    locale: "vi",
    status: "running",
    result: null,
    error_code: null,
}

describe("LeadActionFlowService", () => {
    const build = async () => {
        const leads = mock<LeadRecordsService>()
        leads.require.mockResolvedValue(lead)
        const moduleRef = await Test.createTestingModule({
            providers: [
                LeadActionFlowService,
                { provide: LeadRecordsService, useValue: leads },
                { provide: InboundEventsService, useValue: mock<InboundEventsService>() },
                { provide: CommandBusService, useValue: mock<CommandBusService>() },
                { provide: WorkEngineService, useValue: mock<WorkEngineService>() },
                { provide: WorkItemsService, useValue: mock<WorkItemsService>() },
                { provide: ResponsibilityJournalService, useValue: mock<ResponsibilityJournalService>() },
                { provide: AutomationsService, useValue: mock<AutomationsService>() },
            ],
        }).compile()
        return moduleRef.get(LeadActionFlowService)
    }

    it("refuses to settle a lead that is not won", async () => {
        const service = await build()

        await expect(service.settleWon(ctx, run)).rejects.toMatchObject({ code: LeadActionsErrorCode.NotWon })
    })
})
