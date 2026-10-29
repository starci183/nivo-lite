import { Injectable } from "@nestjs/common"
import type { AutomationOwnerChat } from "@modules/domain/automations"
import { ConnectionSecretReadsService, ConnectionsService } from "@modules/domain/connections"
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
        private readonly secrets: ConnectionSecretReadsService,
        @InjectTelegram() private readonly telegram: TelegramClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /**
     * Tries connected Telegram bots in order and answers whether one reached its registered owner's chat. A lookup that fails is the
     * same as no chat: the report was already posted in Office, so the run goes on with a skipped step and a retry never posts twice.
     */
    async sendToOwner(workspaceId: string, text: string): Promise<boolean> {
        try {
            const connections = await this.connections.listByProvider(workspaceId, "telegram", {
                includeDisconnected: false,
            })
            return await connections.reduce<Promise<boolean>>(
                async (reached, connection) => (await reached) || this.tryConnection(workspaceId, connection, text),
                Promise.resolve(false),
            )
        } catch (cause) {
            this.logger.error(AutomationPortsLogEvent.OwnerChatLookupFailed, cause, { workspaceId })
            return false
        }
    }

    private async tryConnection(workspaceId: string, connection: ConnectionRecord, text: string): Promise<boolean> {
        if (connection.status !== "connected") return false
        const chatId = connection.meta.owner_chat_id
        if (chatId === undefined || chatId === "") return false
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
