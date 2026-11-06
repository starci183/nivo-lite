import { Test } from "@nestjs/testing"
import { builder, fakeIds, mock } from "@starci/jest-preset"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { ChatConversationsService, ChatMessagesService, ChatRecordsErrorCode } from "@modules/domain/chat-records"
import type { ChatConversationTarget } from "@modules/domain/chat-records"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import { LoyaltyCodeDeliveryService } from "./loyalty-code-delivery.service"
import { LoyaltyLogEvent } from "./loyalty.log-events"

const PARAMS = { workspaceId: "ws-1", conversationId: "conversation-1", text: "Your loyalty code is 123456" }
const targetOf = builder<ChatConversationTarget>({
    id: "conversation-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "customer-1",
    connectionId: "connection-1",
})

const build = async () => {
    const logger = mock<Logger>()
    const conversations = mock<ChatConversationsService>()
    const messages = mock<ChatMessagesService>()
    const channels = mock<ChannelDeliveryService>()
    const ids = fakeIds()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyCodeDeliveryService,
            { provide: LOGGER, useValue: logger },
            { provide: ChatConversationsService, useValue: conversations },
            { provide: ChatMessagesService, useValue: messages },
            { provide: ChannelDeliveryService, useValue: channels },
            { provide: IDS, useValue: ids },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyCodeDeliveryService), logger, conversations, messages, channels }
}

describe("LoyaltyCodeDeliveryService", () => {
    describe("send", () => {
        it("send has its first case written", async () => {
            const { service } = await build()
            expect(service.send).toBeInstanceOf(Function)
        })

        it.each([
            { reason: "missing conversation", target: refused(ChatRecordsErrorCode.NotFound) },
            { reason: "unsupported channel", target: ok(targetOf({ channel: "website" })) },
        ])("does not store or send a code for $reason", async ({ target }) => {
            const { service, conversations, messages, channels, logger } = await build()
            conversations.targetOf.mockResolvedValue(target)

            expect(await service.send(PARAMS)).toBe(false)
            expect(conversations.targetOf).toHaveBeenCalledWith("ws-1", "conversation-1")
            expect(messages.storeAgentLine).not.toHaveBeenCalled()
            expect(channels.deliver).not.toHaveBeenCalled()
            expect(logger.error).not.toHaveBeenCalled()
        })

        it.each([
            { channel: "telegram", delivered: true },
            { channel: "zalo", delivered: true },
            { channel: "telegram", delivered: false },
        ])("stores the code for $channel and returns delivery $delivered", async ({ channel, delivered }) => {
            const { service, conversations, messages, channels, logger } = await build()
            conversations.targetOf.mockResolvedValue(ok(targetOf({ channel })))
            messages.storeAgentLine.mockResolvedValue({ id: "message-1", body: PARAMS.text, sent: false })
            channels.deliver.mockResolvedValue({
                delivered,
                outcome: delivered ? "acknowledged" : "rejected",
                failure: null,
            })

            expect(await service.send(PARAMS)).toBe(delivered)
            expect(conversations.targetOf).toHaveBeenCalledWith("ws-1", "conversation-1")
            expect(messages.storeAgentLine).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                conversationId: "conversation-1",
                body: PARAMS.text,
                key: "00000000-0000-4000-8000-000000000001",
            })
            expect(channels.deliver).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                conversationId: "conversation-1",
                messageId: "message-1",
                text: PARAMS.text,
            })
            expect(logger.error).not.toHaveBeenCalled()
        })
    })
})

describe("LoyaltyCodeDeliveryService", () => {
    describe("send failures", () => {
        it("logs a rejected channel delivery and reports failure", async () => {
            const { service, conversations, messages, channels, logger } = await build()
            const failure = { code: "CHANNEL_DELIVERY_FAILED" }
            conversations.targetOf.mockResolvedValue(ok(targetOf()))
            messages.storeAgentLine.mockResolvedValue({ id: "message-1", body: PARAMS.text, sent: false })
            channels.deliver.mockRejectedValue(failure)

            expect(await service.send(PARAMS)).toBe(false)
            expect(messages.storeAgentLine).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                conversationId: "conversation-1",
                body: PARAMS.text,
                key: "00000000-0000-4000-8000-000000000001",
            })
            expect(channels.deliver).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                conversationId: "conversation-1",
                messageId: "message-1",
                text: PARAMS.text,
            })
            expect(logger.error).toHaveBeenCalledWith(LoyaltyLogEvent.CodeDeliveryFailed, failure, {
                conversationId: "conversation-1",
            })
        })

        it("propagates a storage rejection without attempting delivery", async () => {
            const { service, conversations, messages, channels, logger } = await build()
            const failure = { code: "AGENT_MESSAGES_NOT_STORED" }
            conversations.targetOf.mockResolvedValue(ok(targetOf()))
            messages.storeAgentLine.mockRejectedValue(failure)

            await expect(service.send(PARAMS)).rejects.toBe(failure)
            expect(channels.deliver).not.toHaveBeenCalled()
            expect(logger.error).not.toHaveBeenCalled()
        })
    })
})
