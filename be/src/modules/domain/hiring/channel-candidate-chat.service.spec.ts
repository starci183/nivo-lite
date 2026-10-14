import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import { ChannelCandidateChatService } from "./channel-candidate-chat.service"
import { HiringLogEvent } from "./hiring.log-events"

const TARGET: ConversationTarget = {
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "chat-1",
    connectionId: "conn-1",
}

const build = async () => {
    const conversations = mock<AgentConversationsService>()
    const messages = mock<AgentMessagesService>()
    messages.storeAgentMessage.mockResolvedValue("msg-1")
    const delivery = mock<ChannelDeliveryService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelCandidateChatService,
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: ChannelDeliveryService, useValue: delivery },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { chat: moduleRef.get(ChannelCandidateChatService), conversations, messages, delivery, logger }
}

describe("ChannelCandidateChatService", () => {
    it("stores the message in the conversation and delivers it on its channel", async () => {
        const { chat, conversations, messages, delivery } = await build()
        conversations.targetOf.mockResolvedValue(ok(TARGET))
        delivery.deliver.mockResolvedValue({ delivered: true, failure: null })

        await expect(chat.deliver("ws-1", "conv-1", "Interview at 10:00")).resolves.toBe(true)

        expect(messages.storeAgentMessage).toHaveBeenCalledWith("ws-1", "conv-1", "Interview at 10:00")
        expect(delivery.deliver).toHaveBeenCalledWith({
            conversationId: "conv-1",
            messageId: "msg-1",
            text: "Interview at 10:00",
        })
    })

    it("answers false when the channel did not take it", async () => {
        const { chat, conversations, delivery } = await build()
        conversations.targetOf.mockResolvedValue(ok(TARGET))
        delivery.deliver.mockResolvedValue({ delivered: false, failure: "zalo_window_expired" })

        await expect(chat.deliver("ws-1", "conv-1", "x")).resolves.toBe(false)
    })

    it("refuses a conversation of another workspace or one that is gone", async () => {
        const { chat, conversations, messages } = await build()
        conversations.targetOf.mockResolvedValueOnce(ok({ ...TARGET, workspaceId: "ws-2" }))
        conversations.targetOf.mockResolvedValueOnce(refused(AgentConversationsErrorCode.NotFound))

        await expect(chat.deliver("ws-1", "conv-1", "x")).resolves.toBe(false)
        await expect(chat.deliver("ws-1", "conv-1", "x")).resolves.toBe(false)
        expect(messages.storeAgentMessage).not.toHaveBeenCalled()
    })

    it("never throws: a failure is logged and answers false", async () => {
        const { chat, conversations, logger } = await build()
        conversations.targetOf.mockRejectedValue(new Error("db down"))

        await expect(chat.deliver("ws-1", "conv-1", "x")).resolves.toBe(false)
        expect(logger.error).toHaveBeenCalledWith(HiringLogEvent.ChatDeliveryFailed, expect.any(Error), {
            workspaceId: "ws-1",
            conversationId: "conv-1",
        })
    })
})
