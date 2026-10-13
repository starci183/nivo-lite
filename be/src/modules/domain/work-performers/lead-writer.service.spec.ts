import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { LeadDraft, ToolContext } from "@modules/domain/agent-tools"
import { CommandBusService } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LeadWriterService } from "./lead-writer.service"

const ctx: ToolContext = { jobId: "job-1", workspaceId: "ws-1", conversationId: "conv-1" }
const lead: LeadDraft = { contactName: "Lan", need: "tea", company: null, contact: null }

describe("LeadWriterService", () => {
    const build = async () => {
        const conversations = mock<AgentConversationsService>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                LeadWriterService,
                { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() },
                { provide: AgentConversationsService, useValue: conversations },
                { provide: InboundEventsService, useValue: mock<InboundEventsService>() },
                { provide: CommandBusService, useValue: mock<CommandBusService>() },
            ],
        }).compile()
        return { service: moduleRef.get(LeadWriterService), conversations }
    }

    it("answers unavailable when the conversation cannot be read", async () => {
        const { service, conversations } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "refused", code: AgentConversationsErrorCode.NotFound })

        await expect(service.createOrUpdate(ctx, lead)).resolves.toEqual({ leadId: null, status: "unavailable" })
    })
})
