import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CandidateChat } from "./candidate-chat.port"
import { HiringLogEvent } from "./hiring.log-events"

@Injectable()
/**
 * Messages to a candidate in the chat conversation they applied through: the text is stored as the agent's message (so the workbench
 * shows it) and pushed to the candidate's real channel (Telegram, Zalo, Messenger); a website conversation is read in the page itself,
 * so storing it is the delivery. A conversation of another workspace is refused. It never throws: the answer says whether it arrived.
 */
export class ChannelCandidateChatService extends CandidateChat {
    constructor(
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly delivery: ChannelDeliveryService,
        @InjectLogger() private readonly logger: Logger,
    ) {
        super()
    }

    /** Stores and delivers one message; true only when it reached the candidate. */
    override async deliver(workspaceId: string, conversationId: string, text: string): Promise<boolean> {
        try {
            const target = await this.conversations.targetOf(conversationId)
            if (target.kind !== "ok" || target.value.workspaceId !== workspaceId) return false
            const messageId = await this.messages.storeAgentMessage(workspaceId, conversationId, text)
            const result = await this.delivery.deliver({ conversationId, messageId, text })
            return result.delivered
        } catch (cause) {
            this.logger.error(HiringLogEvent.ChatDeliveryFailed, cause, { workspaceId, conversationId })
            return false
        }
    }
}
