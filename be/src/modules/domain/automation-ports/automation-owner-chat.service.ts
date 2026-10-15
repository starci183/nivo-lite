import { Injectable } from "@nestjs/common"
import type { AutomationOwnerChat } from "@modules/domain/automations"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InjectTelegram } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AutomationPortsLogEvent } from "./automation-ports.log-events"

@Injectable()
/** Sends automation reports to the first reachable owner's Telegram chat recorded on a connected bot. */
export class AutomationOwnerChatService implements AutomationOwnerChat {
    constructor(
        private readonly connections: ConnectionsService,
        private readonly secrets: ConnectionSecretsService,
        @InjectTelegram() private readonly telegram: TelegramClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Tries connected Telegram bots in order and answers whether one reached its registered owner's chat. */
    async sendToOwner(workspaceId: string, text: string): Promise<boolean> {
        const connections = await this.connections.listByProvider(workspaceId, "telegram", {
            includeDisconnected: false,
        })
        return connections.reduce<Promise<boolean>>(
            async (reached, connection) => (await reached) || this.tryConnection(workspaceId, connection, text),
            Promise.resolve(false),
        )
    }

    private async tryConnection(workspaceId: string, connection: ConnectionRecord, text: string): Promise<boolean> {
        if (connection.status !== "connected") return false
        const chatId = connection.meta.owner_chat_id
        if (typeof chatId !== "string" || chatId === "") return false
        const token = await this.secrets.botToken(workspaceId, connection.id)
        if (token.kind !== "ok") return false
        return this.telegram.sendMessage(token.value, chatId, text).then(
            () => true,
            (cause: unknown) => {
                this.logger.error(AutomationPortsLogEvent.OwnerChatSendFailed, cause, {
                    workspaceId,
                    connectionId: connection.id,
                })
                return false
            },
        )
    }
}
