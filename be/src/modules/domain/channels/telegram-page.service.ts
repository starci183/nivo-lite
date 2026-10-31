import { Injectable } from "@nestjs/common"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentMessagesFeedReadService } from "@modules/domain/agent-messages"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { CONVERSATIONS_MAX, EVENTS_MAX, messageRowsOf } from "./connection-events.policy"
import type { TelegramPageEvent, TelegramPageView } from "./telegram-page.contracts"
import { maskedChatOf, telegramEventsOf } from "./telegram-page.policy"

/** The channel of the conversations this page lists. */
const TELEGRAM_CHANNEL = "telegram"

const MANAGER = ["owner", "manager"] as const
const PROVIDER = "telegram"

@Injectable()
/**
 * The read model of the page of one Telegram bot connection: what it is, whether it is healthy, the webhook NIVO registered, the agents
 * on it and the live events. The token never leaves and an event carries no message text. The re-check is the connection check the hub
 * already has, which owner and manager both run.
 */
export class TelegramPageService {
    constructor(
        private readonly connections: ConnectionsService,
        private readonly conversations: AgentConversationsReadService,
        private readonly feed: AgentMessagesFeedReadService,
    ) {}

    /** The page of a Telegram connection (owner or manager). */
    async view(actor: ConnectionActor, connectionId: string): Promise<TelegramPageView> {
        await this.connections.authorize(actor, MANAGER)
        const connection = await this.telegramOf(actor, connectionId)
        const agentIds = await this.connections.agentIds(actor.workspaceId, connection.id)
        return {
            id: connection.id,
            name: connection.name,
            status: connection.status,
            healthy: connection.status === "connected" && connection.lastError === null,
            botUsername: connection.meta.bot_username ?? "",
            webhookUrl: this.connections.webhookUrl(PROVIDER, connection.id),
            lastError: connection.lastError,
            lastEventAt: connection.lastEventAt,
            agentIds,
        }
    }

    /** The live events of a Telegram connection, newest first and without any text (owner or manager). */
    async events(actor: ConnectionActor, connectionId: string): Promise<ReadonlyArray<TelegramPageEvent>> {
        await this.connections.authorize(actor, MANAGER)
        const connection = await this.telegramOf(actor, connectionId)
        const conversations = await this.conversations.onConnection(
            actor.workspaceId,
            connection.id,
            TELEGRAM_CHANNEL,
            CONVERSATIONS_MAX,
        )
        const feed = await this.feed.recentIn(
            conversations.map((conversation) => conversation.id),
            EVENTS_MAX,
        )
        const hidden = conversations.map((conversation) => ({
            ...conversation,
            visitorName: maskedChatOf(conversation.externalId),
        }))
        return telegramEventsOf(messageRowsOf(feed, hidden))
    }

    private async telegramOf(actor: ConnectionActor, connectionId: string): Promise<ConnectionRecord> {
        const connection = await this.connections.get(actor.workspaceId, connectionId)
        if (connection.provider !== PROVIDER) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: connectionId } })
        }
        return connection
    }
}
