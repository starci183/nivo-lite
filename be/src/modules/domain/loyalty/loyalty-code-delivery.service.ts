import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { CodeDelivery, CodeDeliveryParams } from "./loyalty.contracts"
import { LoyaltyLogEvent } from "./loyalty.log-events"

const PUSH_CHANNELS: ReadonlyArray<string> = ["telegram", "zalo"]

@Injectable()
/** Carries a public loyalty code into the customer's existing chat with the shop. */
export class LoyaltyCodeDeliveryService implements CodeDelivery {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly channels: ChannelDeliveryService,
    ) {}

    /** Stores and delivers only to a supported conversation owned by the programme's workspace. */
    async deliver(params: CodeDeliveryParams): Promise<boolean> {
        const target = await this.conversations.targetOf(params.conversationId)
        if (
            target.kind !== "ok" ||
            target.value.workspaceId !== params.workspaceId ||
            !PUSH_CHANNELS.includes(target.value.channel)
        )
            return false
        const messageId = await this.messages.storeAgentMessage(params.workspaceId, params.conversationId, params.text)
        return this.channels.deliver({ conversationId: params.conversationId, messageId, text: params.text }).then(
            (result) => result.delivered,
            (cause: unknown) => {
                this.logger.error(LoyaltyLogEvent.CodeDeliveryFailed, cause, { conversationId: params.conversationId })
                return false
            },
        )
    }
}
