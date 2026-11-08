import { Injectable } from "@nestjs/common"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import { InjectIds, type Ids } from "@modules/platform/ids"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { CandidateChat } from "./candidate-chat.port"
import { HiringLogEvent } from "./hiring.log-events"

@Injectable()
/**
 * Messages to a candidate in the chat conversation they applied through: the text is stored as the agent's message (so the workbench
 * shows it) and pushed to the candidate's real channel (Telegram, Zalo, Messenger); a website conversation is read in the page itself,
 * so storing it is the delivery. A conversation of another workspace does not exist for it. It never throws: the answer says whether it arrived.
 */
export class ChannelCandidateChatService extends CandidateChat {
    constructor(
        private readonly conversations: ChatConversationsService,
        private readonly messages: ChatMessagesService,
        private readonly delivery: ChannelDeliveryService,
        @InjectIds() private readonly ids: Ids,
        @InjectLogger() private readonly logger: Logger,
    ) {
        super()
    }

    /** Stores and delivers one message; true only when it reached the candidate. */
    override async deliver(workspaceId: string, conversationId: string, text: string): Promise<boolean> {
        try {
            const target = await this.conversations.targetOf(workspaceId, conversationId)
            if (target.kind !== "ok") return false
            const stored = await this.messages.storeAgentLine({
                workspaceId,
                conversationId,
                body: text,
                key: this.ids.next(),
            })
            const result = await this.delivery.deliver({ workspaceId, conversationId, messageId: stored.id, text })
            return result.delivered
        } catch (cause) {
            this.logger.error(HiringLogEvent.ChatDeliveryFailed, cause, { workspaceId, conversationId })
            return false
        }
    }
}
