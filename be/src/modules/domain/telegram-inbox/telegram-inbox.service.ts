import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import type {
    PendingTelegramInboxReceipt,
    TelegramDeliveryRecorded,
    TelegramRawDelivery,
} from "./telegram-inbox.contracts"
import { TELEGRAM_DELIVERY_QUEUE } from "./telegram-inbox.contracts"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConversationsService, readTelegramUpdate } from "@modules/domain/conversations"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import {
    COMPLETE_TELEGRAM_INBOX,
    FIND_PENDING_TELEGRAM_INBOX,
    INSERT_TELEGRAM_INBOX,
} from "./persistence/telegram-inbox.sql"

@Injectable()
/** Claims each Telegram update once, then publishes its durable receipt; a deferred consumer stores the message and queues its answer. */
export class TelegramInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly conversations: ConversationsService,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
    ) {}

    /** A redelivered update is acknowledged without being processed again; an update the chat does not answer is acknowledged and dropped. */
    acceptTelegramDelivery(rawBody: TelegramRawDelivery, connection: string): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const payload = { connection, rawBody: rawBody?.toString("utf8") }
            const inbound = readTelegramUpdate(`[${this.catalog.get("conversations.photoSent", {}, "vi")}]`, rawBody)
            const deliveryId = inbound.kind === "ok" ? `${payload.connection}:${inbound.value.updateId}` : ""
            if (
                !(await this.inbox.claim("telegram", deliveryId, manager, {
                    insert: INSERT_TELEGRAM_INBOX,
                    payload,
                }))
            )
                return
            const message: TelegramDeliveryRecorded = { deliveryId }
            await this.outbox.write(manager, TELEGRAM_DELIVERY_QUEUE, message, {
                dedupeKey: `${TELEGRAM_DELIVERY_QUEUE}:${deliveryId}`,
            })
        })
    }

    /** Resolves and processes a committed receipt atomically; retries leave a failed receipt pending. */
    processRecordedDelivery(message: TelegramDeliveryRecorded): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const [pending] = await manager.query<Array<PendingTelegramInboxReceipt>>(FIND_PENDING_TELEGRAM_INBOX, [
                message.deliveryId,
            ])
            if (pending === undefined) return
            const rawBody = Buffer.from(pending.payload.rawBody, "utf8")
            const inbound = readTelegramUpdate(`[${this.catalog.get("conversations.photoSent", {}, "vi")}]`, rawBody)
            if (inbound.kind === "ok")
                await this.conversations.acceptTelegram(pending.payload.connection, inbound.value, manager)
            await manager.query(COMPLETE_TELEGRAM_INBOX, [pending.id])
        })
    }
}
