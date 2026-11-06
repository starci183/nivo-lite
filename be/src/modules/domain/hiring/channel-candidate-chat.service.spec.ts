import { Test } from "@nestjs/testing"
import { fakeIds, mock } from "@starci/jest-preset"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { ChatConversationsService, ChatMessagesService, ChatRecordsErrorCode } from "@modules/domain/chat-records"
import type { ChatConversationTarget } from "@modules/domain/chat-records"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import { ChannelCandidateChatService } from "./channel-candidate-chat.service"
import { HiringLogEvent } from "./hiring.log-events"

const TARGET: ChatConversationTarget = {
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "chat-1",
    connectionId: "conn-1",
}

const build = async () => {
    const conversations = mock<ChatConversationsService>()
    const messages = mock<ChatMessagesService>()
    messages.storeAgentLine.mockResolvedValue({ id: "msg-1", body: "Interview at 10:00", sent: false })
    const ids = fakeIds()
    const delivery = mock<ChannelDeliveryService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelCandidateChatService,
            { provide: ChatConversationsService, useValue: conversations },
            { provide: ChatMessagesService, useValue: messages },
            { provide: IDS, useValue: ids },
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
        delivery.deliver.mockResolvedValue({ delivered: true, outcome: "acknowledged", failure: null })

        await expect(chat.deliver("ws-1", "conv-1", "Interview at 10:00")).resolves.toBe(true)

        expect(conversations.targetOf).toHaveBeenCalledWith("ws-1", "conv-1")
        expect(messages.storeAgentLine).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            body: "Interview at 10:00",
            key: "00000000-0000-4000-8000-000000000001",
        })
        expect(delivery.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            messageId: "msg-1",
            text: "Interview at 10:00",
        })
    })

    it("answers false when the channel did not take it", async () => {
        const { chat, conversations, delivery } = await build()
        conversations.targetOf.mockResolvedValue(ok(TARGET))
        delivery.deliver.mockResolvedValue({ delivered: false, outcome: "rejected", failure: "zalo_window_expired" })

        await expect(chat.deliver("ws-1", "conv-1", "x")).resolves.toBe(false)
    })

    it("refuses a conversation that is gone in the workspace", async () => {
        const { chat, conversations, messages } = await build()
        conversations.targetOf.mockResolvedValue(refused(ChatRecordsErrorCode.NotFound))

        await expect(chat.deliver("ws-1", "conv-1", "x")).resolves.toBe(false)
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
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
