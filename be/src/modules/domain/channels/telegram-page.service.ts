import { Injectable } from "@nestjs/common"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import type { TelegramPageView } from "./telegram-page.contracts"

const MANAGER = ["owner", "manager"] as const
const PROVIDER = "telegram"

@Injectable()
/**
 * The read model of the page of one Telegram bot connection: what it is, whether it is healthy, the webhook NIVO registered, the agents
 * on it. The token never leaves. The re-check is the connection check the hub already has, which owner and manager both run.
 */
export class TelegramPageService {
    constructor(private readonly connections: ConnectionsService) {}

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

    private async telegramOf(actor: ConnectionActor, connectionId: string): Promise<ConnectionRecord> {
        const connection = await this.connections.get(actor.workspaceId, connectionId)
        if (connection.provider !== PROVIDER) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: connectionId } })
        }
        return connection
    }
}
