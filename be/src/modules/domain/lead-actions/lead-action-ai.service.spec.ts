import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentsService } from "@modules/domain/agents"
import type { WorkContext } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { MessagesService } from "@modules/domain/messages"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import type { ResponsibilityListing } from "@modules/domain/responsibilities"
import { DEEPSEEK_CLIENT } from "@modules/integrations/deepseek"
import type { DeepseekClient } from "@modules/integrations/deepseek"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LeadActionAiService } from "./lead-action-ai.service"

const LEAD = "11111111-1111-4111-8111-111111111111"
const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

const lead: LeadRecordRow = {
    id: LEAD,
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "zalo",
    need: "tea",
    stage: "qualified",
    context_summary: "buys tea",
    phone: null,
    email: null,
    origin: "live",
}

const open: ResponsibilityListing = {
    id: "resp-1",
    workspace_id: "ws-1",
    lead_id: LEAD,
    title: "Call back",
    owner_kind: "human",
    owner_agent_id: null,
    owner_name: "Lan",
    next_action: "Call",
    due_at: null,
    status: "open",
    created_at: "2026-10-14T00:00:00.000Z",
    contact_name: "Lan",
    company: "Hue Tea",
    leadStage: "qualified",
}

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const leads = mock<LeadRecordsService>()
    leads.require.mockResolvedValue(lead)
    const events = mock<EventsService>()
    events.leadHistory.mockResolvedValue([{ summary: "asked about tea", evidence: null }])
    events.record.mockResolvedValue(undefined)
    const ai = mock<DeepseekClient>()
    ai.summarizeContext.mockResolvedValue("A tea buyer.")
    const responsibilities = mock<ResponsibilityJournalService>()
    responsibilities.list.mockResolvedValue([open])
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("context refreshed")
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadActionAiService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock("2026-10-14T00:00:00.000Z") },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LeadRecordsService, useValue: leads },
            { provide: EventsService, useValue: events },
            { provide: AgentsService, useValue: mock<AgentsService>() },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: MessagesService, useValue: mock<MessagesService>() },
            { provide: DEEPSEEK_CLIENT, useValue: ai },
        ],
    }).compile()
    return { ai: moduleRef.get(LeadActionAiService), leads, events, model: ai }
}

describe("LeadActionAiService", () => {
    it("stores the brief the model wrote and answers it", async () => {
        const { ai, leads, events } = await build()

        await expect(ai.refreshContext(ctx, LEAD)).resolves.toEqual({ leadId: LEAD, contextSummary: "A tea buyer." })
        expect(leads.replaceContext).toHaveBeenCalledWith("ws-1", LEAD, "A tea buyer.", expect.anything())
        expect(events.record).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "context.summarised", evidence: "A tea buyer." }),
            expect.anything(),
        )
    })

    it("keeps an open responsibility instead of proposing another", async () => {
        const { ai, model } = await build()

        await expect(ai.suggestOwner(ctx, "user-1", LEAD)).resolves.toEqual({
            leadId: LEAD,
            responsibilityId: "resp-1",
        })
        expect(model.proposeResponsibility).not.toHaveBeenCalled()
    })
})
