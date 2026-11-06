import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ChatConversationsService, ChatMessagesService, chatStampOf } from "@modules/domain/chat-records"
import type { ChatMessageStamp } from "@modules/domain/chat-records"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { CustomerIntakeService } from "./customer-intake.service"
import type { Hearing } from "./customer-hearing.contracts"

@Injectable()
/**
 * What happens once a channel message reached its front-door agent: the conversation is opened or followed to the agent, the customer
 * message is stored once per channel id, and its answer is started unless a person holds the conversation. The records are written in
 * their own transactions, the answer in the transaction of the webhook inbox; the same message heard again (a webhook and the poll that
 * reconciles it, a manual import, a replayed inbound event) finds the record it was stored as and asks for the answer to that same message,
 * which its own wake key keeps to one.
 */
export class CustomerHearingService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly intake: CustomerIntakeService,
        private readonly conversations: ChatConversationsService,
        private readonly messages: ChatMessagesService,
    ) {}

    /** Stores the customer's message once, then starts its answer unless a person took the conversation over. */
    async hear(hearing: Hearing, manager: EntityManager): Promise<void> {
        const { workspaceId, connectionId, channel, customerId, visitor, agent, text, channelEventId } = hearing
        const { conversation, created } = await this.conversations.meet({
            workspaceId,
            agentId: agent.id,
            channel,
            customerId,
            visitor,
            connectionId,
        })
        const heard = await this.messages.storeCustomer(
            workspaceId,
            conversation.id,
            text,
            channelEventId,
            this.stampOf(hearing),
        )
        // A person who took the conversation over answers it themselves: the message is stored and the AI stays quiet.
        if (conversation.handledBy !== null) return
        await this.intake.answer(
            {
                workspaceId,
                agentId: conversation.agentId,
                conversationId: conversation.id,
                messageId: heard.id,
                channelEventId,
                lookupName: created && channel === "zalo",
            },
            manager,
        )
    }

    /** The time the channel says the customer sent the message (never in the future), or null to store it at the time it arrived. */
    private stampOf(hearing: Hearing): ChatMessageStamp | null {
        const { sentAt, channelEventId } = hearing
        return sentAt === undefined || sentAt === null
            ? null
            : chatStampOf(sentAt, this.clock.now().getTime(), channelEventId)
    }
}
