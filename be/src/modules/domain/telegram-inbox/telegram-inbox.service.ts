import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConversationsService, readTelegramUpdate } from "@modules/domain/conversations"
import { acceptWebhookDelivery, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { COMPLETE_TELEGRAM_INBOX, INSERT_TELEGRAM_INBOX } from "./persistence/telegram-inbox.sql"

@Injectable()
/** Claims each Telegram update once, then stores the message and enqueues its answer in the same transaction. */
export class TelegramInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly conversations: ConversationsService,
    ) {}

    /** A redelivered update is acknowledged without being processed again; an update the chat does not answer is acknowledged and dropped. */
    async acceptTelegramDelivery(connectionId: string, rawBody?: Buffer): Promise<void> {
        const inbound = readTelegramUpdate(`[${this.catalog.get("conversations.photoSent", {}, "vi")}]`, rawBody)
        if (inbound.kind !== "ok") return
        const update = inbound.value
        await acceptWebhookDelivery({
            entityManager: this.entityManager,
            insert: INSERT_TELEGRAM_INBOX,
            complete: COMPLETE_TELEGRAM_INBOX,
            provider: "telegram",
            deliveryId: `${connectionId}:${update.updateId}`,
            payload: { connectionId, updateId: update.updateId, messageId: update.messageId },
            process: (manager) => this.conversations.acceptTelegram(connectionId, update, manager),
        })
    }
}
