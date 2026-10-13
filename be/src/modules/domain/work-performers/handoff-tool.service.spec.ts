import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import type { ToolContext } from "@modules/domain/agent-tools"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HandoffToolService } from "./handoff-tool.service"

const ctx: ToolContext = { jobId: "job-1", workspaceId: "ws-1", conversationId: "conv-1" }

describe("HandoffToolService", () => {
    it("holds the conversation for a person and posts the system line", async () => {
        const conversations = mock<AgentConversationsService>()
        const messages = mock<AgentMessagesService>()
        const catalog = mock<MessageCatalog>()
        catalog.get.mockReturnValue("A person will take this")
        const moduleRef = await Test.createTestingModule({
            providers: [
                HandoffToolService,
                { provide: MESSAGE_CATALOG, useValue: catalog },
                { provide: AgentConversationsService, useValue: conversations },
                { provide: AgentMessagesService, useValue: messages },
            ],
        }).compile()

        await expect(moduleRef.get(HandoffToolService).handoff(ctx)).resolves.toBeUndefined()

        expect(conversations.handToPerson).toHaveBeenCalledWith("ws-1", "conv-1", "NIVO engine")
        expect(catalog.get).toHaveBeenCalledWith("performers.needsHuman", {}, "vi")
        expect(messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "A person will take this")
    })
})
