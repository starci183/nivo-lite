import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationRef } from "@modules/domain/agent-conversations"
import { AgentChannelRefsService, AgentMessagesService, messageStampOf } from "@modules/domain/agent-messages"
import { InboundFilesService } from "@modules/domain/chat-files"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { ChatTurnQueue } from "@modules/queues/chat-turn"
import { CustomerIntakeService } from "./customer-intake.service"
import type { Hearing, Meeting } from "./customer-hearing.contracts"

const LOCALE = "vi"

/** The conversation a meeting reached, and whether this meeting opened it. */
interface Met {
    readonly conversation: ConversationRef
    readonly created: boolean
}

/** The customer message a hearing stands for, and whether this hearing stored it or found it stored by an earlier one. */
interface Heard {
    readonly messageId: string
    readonly stored: boolean
}

@Injectable()
/**
 * What happens once a channel message reached its front-door agent, inside the transaction of the webhook inbox: the conversation is opened
 * or followed to the agent, the customer message is stored once per conversation and channel id with its files, and its answer is started
 * unless a person holds the conversation. The same message heard again (a webhook and the poll that reconciles it, a manual import, a
 * replayed inbound event) finds the row it was stored as: neither the message nor its files are stored twice, and the answer is asked for
 * that same message, which its own door keeps to one.
 */
export class CustomerHearingService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly chatTurns: ChatTurnQueue,
        private readonly intake: CustomerIntakeService,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly channelRefs: AgentChannelRefsService,
        private readonly inboundFiles: InboundFilesService,
    ) {}

    /** Stores the customer's message once with its files, then starts its answer unless a person took the conversation over. */
    async hear(hearing: Hearing, manager: EntityManager): Promise<void> {
        const { conversation, created } = await this.meet(hearing, manager)
        const heard = await this.messageOf(hearing, conversation.id, manager)
        if (heard.stored) await this.keepFiles(hearing, conversation.id, heard.messageId, manager)
        // A person who took the conversation over answers it themselves: the message is stored and the AI stays quiet.
        if (conversation.handledBy !== null) return
        await this.intake.answer(
            {
                workspaceId: hearing.workspaceId,
                agentId: conversation.agentId,
                conversationId: conversation.id,
                messageId: heard.messageId,
                channelEventId: hearing.channelEventId,
                lookupName: created && hearing.channel === "zalo",
            },
            manager,
        )
    }

    /** Opens a new visit with the agent's greeting (or the default line) and asks for its delivery, with no AI call. */
    async greet(meeting: Meeting, channelEventId: string, manager: EntityManager): Promise<void> {
        const { conversation } = await this.meet(meeting, manager)
        const greeting = meeting.agent.greeting.trim() || this.catalog.get("conversations.fallbackGreeting", {}, LOCALE)
        const messageId = await this.messages.storeGreeting(meeting.workspaceId, conversation.id, greeting, manager)
        await this.chatTurns.enqueueChatTurn(
            {
                kind: "deliver",
                workspaceId: meeting.workspaceId,
                conversationId: conversation.id,
                messageId,
                channelEventId,
                lookupName: false,
            },
            manager,
        )
    }

    /** The row of the message: the one an earlier hearing stored, or a new one marked with the channel id of the message. */
    private async messageOf(hearing: Hearing, conversationId: string, manager: EntityManager): Promise<Heard> {
        const known = await this.channelRefs.messageOf(conversationId, hearing.channelEventId, manager)
        if (known !== null) return { messageId: known, stored: false }
        const messageId = await this.storeCustomer(hearing, conversationId, manager)
        await this.channelRefs.mark(messageId, hearing.channelEventId, manager)
        return { messageId, stored: true }
    }

    private async keepFiles(
        hearing: Hearing,
        conversationId: string,
        messageId: string,
        manager: EntityManager,
    ): Promise<void> {
        const scope = { workspaceId: hearing.workspaceId, conversationId }
        await eachInOrder(hearing.files ?? [], async (file) => {
            await this.inboundFiles.keep(scope, file, hearing.channelEventId, messageId, manager)
        })
    }

    /** Stores the customer's message at the time the channel says it was sent (never in the future), or at the time it arrived when the channel gave none. */
    private storeCustomer(hearing: Hearing, conversationId: string, manager: EntityManager): Promise<string> {
        const { workspaceId, text, sentAt, channelEventId } = hearing
        if (sentAt === undefined || sentAt === null)
            return this.messages.storeCustomer(workspaceId, conversationId, text, manager)
        const stamp = messageStampOf(sentAt, this.clock.now().getTime(), channelEventId)
        return this.messages.storeCustomer(workspaceId, conversationId, text, manager, null, stamp)
    }

    /** The customer conversation on this connection: opened on the first message and followed to the current front door of the connection. */
    private async meet(meeting: Meeting, manager: EntityManager): Promise<Met> {
        const found = await this.conversations.find(
            meeting.workspaceId,
            meeting.channel,
            meeting.connectionId,
            meeting.customerId,
            manager,
        )
        if (found.kind !== "ok") {
            const opened = await this.conversations.open(
                {
                    workspaceId: meeting.workspaceId,
                    agentId: meeting.agent.id,
                    channel: meeting.channel,
                    customerId: meeting.customerId,
                    visitor: meeting.visitor,
                    connectionId: meeting.connectionId,
                },
                manager,
            )
            return { conversation: opened, created: true }
        }
        if (found.value.agentId === meeting.agent.id) return { conversation: found.value, created: false }
        await this.conversations.rebind(found.value.id, meeting.agent.id, manager)
        return { conversation: { ...found.value, agentId: meeting.agent.id }, created: false }
    }
}
