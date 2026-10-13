import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LoyaltyCodeDeliveryService } from "./loyalty-code-delivery.service"

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
    describe("deliver", () => {
        it("deliver has its first case written", async () => {
            const { service } = await build()
            expect(service.deliver).toBeInstanceOf(Function)
        })
    })
})
