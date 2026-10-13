import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationRef } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { ConnectionsService } from "@modules/domain/connections"
import type { IntakeConnection } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ChatTurnQueue } from "@modules/queues/chat-turn"
import type { FrontAgent, MetaInbound, TelegramInbound, ZaloInbound } from "./conversations.contracts"
import type { FrontAgentRow } from "./persistence/conversations.rows"
import { FIND_FRONT_AGENT } from "./persistence/conversations.sql"

/** The language of the lines the workspace customers and staff read from the system. */
const LOCALE = "vi"

/** Where a customer was met, and who answers them. */
interface Meeting {
    readonly workspaceId: string
    readonly connectionId: string
    readonly channel: string
    readonly customerId: string
    readonly visitor: string
    readonly agent: FrontAgent
}

/** A meeting with the words the customer wrote and the channel own id of that message. */
interface Hearing extends Meeting {
    readonly text: string
    readonly channelEventId: string
}

@Injectable()
/**
 * Turns a verified delivery of a messaging channel into the stored conversation and the job that answers it. It runs inside the transaction of the
 * webhook inbox, so the message and its job exist together or not at all. A connection with nobody bound only stores the message in the inbox.
 */
export class ConversationsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly chatTurns: ChatTurnQueue,
        private readonly connections: ConnectionsService,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly inboundEvents: InboundEventsService,
        private readonly zaloCredentials: ZaloCredentialsService,
    ) {}

    /** One Telegram message: answered by the front-door agent of the connection, or only stored when none is bound. "/start" opens a new visit with the greeting. */
    async acceptTelegram(connectionId: string, inbound: TelegramInbound, manager: EntityManager): Promise<void> {
        const connection = await this.connections.intakeOf(connectionId, "telegram", manager)
        if (connection.kind !== "ok") return
        const channelEventId = `tg:${inbound.chatId}:${inbound.messageId}`
        const agent = await this.frontAgentOf(connectionId, manager)
        if (agent === undefined) {
            await this.keepUnrouted(
                connection.value,
                "telegram",
                inbound.visitor,
                inbound.text,
                `tg:${connectionId}:${inbound.chatId}:${inbound.messageId}`,
                manager,
            )
            return
        }
        const meeting: Meeting = {
            workspaceId: connection.value.workspaceId,
            connectionId,
            channel: "telegram",
            customerId: inbound.chatId,
            visitor: inbound.visitor,
            agent,
        }
        if (!inbound.isStart) {
            await this.hear({ ...meeting, text: inbound.text, channelEventId }, manager)
            return
        }
        await this.conversations.archive(
            meeting.workspaceId,
            meeting.channel,
            connectionId,
            inbound.chatId,
            `${inbound.chatId}:${this.clock.now().getTime()}`,
            manager,
        )
        await this.greet(meeting, channelEventId, manager)
    }

    /** One Zalo text message: the connection turns connected on its first event, then the message is answered or only stored like a Telegram one. */
    async acceptZalo(connectionId: string, inbound: ZaloInbound, manager: EntityManager): Promise<void> {
        const connection = await this.connections.intakeOf(connectionId, "zalo_oa", manager)
        if (connection.kind !== "ok" || (await this.isOtherApp(connectionId, inbound.appId))) return
        const workspaceId = connection.value.workspaceId
        const known = await this.conversations.find(workspaceId, "zalo", connectionId, inbound.userId, manager)
        const visitor =
            (known.kind === "ok" ? known.value.visitorName : null) ??
            this.catalog.get("conversations.zaloGuest", {}, LOCALE)
        await this.connections.markReceived(
            connectionId,
            { amount: 0, content: visitor, at: this.clock.now().toISOString(), text: inbound.text.slice(0, 160) },
            manager,
        )
        const agent = await this.frontAgentOf(connectionId, manager)
        if (agent === undefined) {
            await this.keepUnrouted(
                connection.value,
                "zalo",
                visitor,
                inbound.text,
                `zalo:${connectionId}:${inbound.messageId}`,
                manager,
            )
            return
        }
        await this.hear(
            {
                workspaceId,
                connectionId,
                channel: "zalo",
                customerId: inbound.userId,
                visitor,
                agent,
                text: inbound.text,
                channelEventId: `zalo:${inbound.messageId}`,
            },
            manager,
        )
    }

    /** One Facebook or Instagram direct message: answered by the front-door agent of the connection, or only stored when none is bound. */
    async acceptMeta(connectionId: string, inbound: MetaInbound, manager: EntityManager): Promise<void> {
        const connection = await this.connections.intakeOf(connectionId, "meta", manager)
        if (connection.kind !== "ok") return
        const visitor = inbound.visitor ?? this.catalog.get(`conversations.${inbound.platform}Guest`, {}, LOCALE)
        const agent = await this.frontAgentOf(connectionId, manager)
        const eventId = `meta:${inbound.eventId}`
        if (agent === undefined) {
            await this.keepUnrouted(connection.value, inbound.platform, visitor, inbound.text, `${eventId}:${connectionId}`, manager)
            return
        }
        await this.hear(
            {
                workspaceId: connection.value.workspaceId,
                connectionId,
                channel: inbound.platform,
                customerId: inbound.personId,
                visitor,
                agent,
                text: inbound.text,
                channelEventId: eventId,
            },
            manager,
        )
    }

    private async hear(hearing: Hearing, manager: EntityManager): Promise<void> {
        const { conversation, created } = await this.meet(hearing, manager)
        const messageId = await this.messages.storeCustomer(hearing.workspaceId, conversation.id, hearing.text, manager)
        // A person who took the conversation over answers it themselves: the message is stored and the AI stays quiet.
        if (conversation.handledBy !== null) return
        await this.chatTurns.enqueueChatTurn(
            {
                kind: "turn",
                workspaceId: hearing.workspaceId,
                conversationId: conversation.id,
                messageId,
                channelEventId: hearing.channelEventId,
                lookupName: created && hearing.channel === "zalo",
            },
            manager,
        )
    }

    private async greet(meeting: Meeting, channelEventId: string, manager: EntityManager): Promise<void> {
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

    /** The customer conversation on this connection: opened on the first message and followed to the current front door of the connection. */
    private async meet(
        meeting: Meeting,
        manager: EntityManager,
    ): Promise<{ readonly conversation: ConversationRef; readonly created: boolean }> {
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

    private async keepUnrouted(
        connection: IntakeConnection,
        channel: string,
        sender: string,
        body: string,
        eventId: string,
        manager: EntityManager,
    ): Promise<void> {
        await this.inboundEvents.keepUnrouted(manager, {
            workspaceId: connection.workspaceId,
            channel,
            sender,
            body,
            eventId,
        })
    }

    private async isOtherApp(connectionId: string, appId: string): Promise<boolean> {
        if (appId === "") return false
        const loaded = await this.zaloCredentials.load(connectionId)
        return loaded.kind === "ok" && loaded.value.secret.appId !== appId
    }

    private async frontAgentOf(connectionId: string, manager: EntityManager): Promise<FrontAgent | undefined> {
        const row = (await manager.query<Array<FrontAgentRow>>(FIND_FRONT_AGENT, [connectionId]))[0]
        return row === undefined ? undefined : { id: row.id, greeting: row.greeting }
    }
}
