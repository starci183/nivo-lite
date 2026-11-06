import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { ToolContext } from "@modules/domain/agent-tools"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { humanConversation } from "@tests/fixtures/builders/chat-features.builder"
import { ConversationLeadsService } from "./conversation-leads.service"

const ctx: ToolContext = { jobId: "job-1", workspaceId: "ws-1", conversationId: "conv-1" }

describe("ConversationLeadsService", () => {
    const build = async () => {
        const conversations = mock<ChatConversationsService>()
        const moduleRef = await Test.createTestingModule({
            providers: [ConversationLeadsService, { provide: ChatConversationsService, useValue: conversations }],
        }).compile()
        return { leads: moduleRef.get(ConversationLeadsService), conversations }
    }

    it("answers the lead of the conversation", async () => {
        const { leads, conversations } = await build()
        conversations.humanOf.mockResolvedValue(humanConversation({ leadId: "lead-1" }))

        await expect(leads.leadIdOf(ctx)).resolves.toBe("lead-1")

        expect(conversations.humanOf).toHaveBeenCalledWith("ws-1", "conv-1")
    })

    it("answers null when the customer is not a lead yet", async () => {
        const { leads, conversations } = await build()
        conversations.humanOf.mockResolvedValue(humanConversation())

        await expect(leads.leadIdOf(ctx)).resolves.toBeNull()
    })

    it("answers null when the conversation cannot be read", async () => {
        const { leads, conversations } = await build()
        conversations.humanOf.mockResolvedValue(null)

        await expect(leads.leadIdOf(ctx)).resolves.toBeNull()
    })
})
