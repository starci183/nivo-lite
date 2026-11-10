import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChannelOwnersService } from "@modules/domain/agent-connections"
import { ChatConversationsService } from "@modules/domain/chat-records"
import type { ChatHumanConversation } from "@modules/domain/chat-records"
import { ConversationOwnersService } from "./conversation-owners.service"

/** A conversation of the workspace that came in on a connection, or on none (website chat). */
const conversationOn = (connectionId: string | null): ChatHumanConversation =>
    mock<ChatHumanConversation>({ id: "c-1", workspaceId: "ws-1", connectionId })

const build = async (conversation: ChatHumanConversation | null) => {
    const conversations = mock<ChatConversationsService>()
    conversations.humanOf.mockResolvedValue(conversation)
    const owners = mock<ChannelOwnersService>()
    owners.ownerOf.mockResolvedValue({
        connectionId: "tg-1",
        agentId: "sales-lan",
        agentName: "Lan",
        module: "sales",
        purpose: "outbound_chat",
        grantedAt: new Date("2026-11-01T00:00:00.000Z"),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConversationOwnersService,
            { provide: ChatConversationsService, useValue: conversations },
            { provide: ChannelOwnersService, useValue: owners },
        ],
    }).compile()
    return { service: moduleRef.get(ConversationOwnersService), conversations, owners }
}

describe("ConversationOwnersService", () => {
    it("answers the agent of the role that owns the channel the conversation came in on", async () => {
        const { service, conversations, owners } = await build(conversationOn("tg-1"))

        await expect(service.ownerAgentOf("ws-1", "c-1", "sales")).resolves.toBe("sales-lan")
        expect(conversations.humanOf).toHaveBeenCalledWith("ws-1", "c-1")
        expect(owners.ownerOf).toHaveBeenCalledWith("tg-1", "sales")
    })

    it("answers none when no agent of the role answers the channel", async () => {
        const { service, owners } = await build(conversationOn("tg-1"))
        owners.ownerOf.mockResolvedValue(null)

        await expect(service.ownerAgentOf("ws-1", "c-1", "sales")).resolves.toBeNull()
    })

    it("answers none, asking no channel, for a conversation on no connection or not in the workspace", async () => {
        const website = await build(conversationOn(null))
        const missing = await build(null)

        await expect(website.service.ownerAgentOf("ws-1", "c-1", "sales")).resolves.toBeNull()
        await expect(missing.service.ownerAgentOf("ws-1", "c-x", "sales")).resolves.toBeNull()
        expect(website.owners.ownerOf).not.toHaveBeenCalled()
        expect(missing.owners.ownerOf).not.toHaveBeenCalled()
    })

    it("answers the owner of the channel of the customer's newest conversation that has a connection", async () => {
        const { service, conversations, owners } = await build(null)
        conversations.ofLeads.mockResolvedValue([conversationOn(null), conversationOn("tg-1")])

        await expect(service.ownerAgentOfLead("ws-1", "l-1", "sales")).resolves.toBe("sales-lan")
        expect(conversations.ofLeads).toHaveBeenCalledWith("ws-1", ["l-1"])
        expect(owners.ownerOf).toHaveBeenCalledWith("tg-1", "sales")
    })

    it("answers none, asking no channel, for a customer with no conversation on a connection", async () => {
        const { service, conversations, owners } = await build(null)
        conversations.ofLeads.mockResolvedValue([conversationOn(null)])

        await expect(service.ownerAgentOfLead("ws-1", "l-1", "sales")).resolves.toBeNull()
        expect(owners.ownerOf).not.toHaveBeenCalled()
    })
})
