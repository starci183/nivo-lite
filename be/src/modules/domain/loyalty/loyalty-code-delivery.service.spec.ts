import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import { LoyaltyCodeDeliveryService } from "./loyalty-code-delivery.service"
import { LoyaltyLogEvent } from "./loyalty.log-events"

const PARAMS = { workspaceId: "ws-1", conversationId: "conversation-1", text: "Your loyalty code is 123456" }
const targetOf = builder<ConversationTarget>({
    id: "conversation-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "customer-1",
    connectionId: "connection-1",
})

const build = async () => {
    const logger = mock<Logger>()
    const conversations = mock<AgentConversationsService>()
    const messages = mock<AgentMessagesService>()
    const channels = mock<ChannelDeliveryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyCodeDeliveryService,
            { provide: LOGGER, useValue: logger },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: ChannelDeliveryService, useValue: channels },
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
            { reason: "missing conversation", target: refused(AgentConversationsErrorCode.NotFound) },
            { reason: "another workspace", target: ok(targetOf({ workspaceId: "another-workspace" })) },
            { reason: "unsupported channel", target: ok(targetOf({ channel: "website" })) },
        ])("does not store or send a code for $reason", async ({ target }) => {
            const { service, conversations, messages, channels, logger } = await build()
            conversations.targetOf.mockResolvedValue(target)

            expect(await service.send(PARAMS)).toBe(false)
            expect(conversations.targetOf).toHaveBeenCalledWith("conversation-1")
            expect(messages.storeAgentMessage).not.toHaveBeenCalled()
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
            messages.storeAgentMessage.mockResolvedValue("message-1")
            channels.deliver.mockResolvedValue({ delivered, failure: null })

            expect(await service.send(PARAMS)).toBe(delivered)
            expect(conversations.targetOf).toHaveBeenCalledWith("conversation-1")
            expect(messages.storeAgentMessage).toHaveBeenCalledWith("ws-1", "conversation-1", PARAMS.text)
            expect(channels.deliver).toHaveBeenCalledWith({
                conversationId: "conversation-1",
                messageId: "message-1",
                text: PARAMS.text,
            })
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("logs a rejected channel delivery and reports failure", async () => {
            const { service, conversations, messages, channels, logger } = await build()
            const failure = { code: "CHANNEL_DELIVERY_FAILED" }
            conversations.targetOf.mockResolvedValue(ok(targetOf()))
            messages.storeAgentMessage.mockResolvedValue("message-1")
            channels.deliver.mockRejectedValue(failure)

            expect(await service.send(PARAMS)).toBe(false)
            expect(messages.storeAgentMessage).toHaveBeenCalledWith("ws-1", "conversation-1", PARAMS.text)
            expect(channels.deliver).toHaveBeenCalledWith({
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
            messages.storeAgentMessage.mockRejectedValue(failure)

            await expect(service.send(PARAMS)).rejects.toBe(failure)
            expect(channels.deliver).not.toHaveBeenCalled()
            expect(logger.error).not.toHaveBeenCalled()
        })
    })
})
