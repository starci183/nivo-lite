import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import type { ZaloRawDelivery, PendingZaloReceipt } from "./zalo-inbox.contracts"
import { ZALO_DELIVERY_QUEUE } from "@modules/queues/zalo-delivery"
import type { ZaloDeliveryRecorded } from "@modules/queues/zalo-delivery"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConversationsService, readZaloEvent } from "@modules/domain/conversations"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { COMPLETE_ZALO_INBOX, FIND_PENDING_ZALO_INBOX, INSERT_ZALO_INBOX } from "./persistence/zalo-inbox.sql"

@Injectable()
/** Claims each Zalo message once, then publishes its durable receipt; a deferred consumer stores it and queues its answer. */
export class ZaloInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly conversations: ConversationsService,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
    ) {}

    /** A redelivered message is acknowledged without being processed again; an event that is not a customer text is acknowledged and dropped. */
    acceptZaloDelivery(rawBody: ZaloRawDelivery, connection: string): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const payload = { connection, rawBody: rawBody?.toString("utf8") }
            const inbound = readZaloEvent(rawBody)
            const deliveryId = inbound.kind === "ok" ? `${payload.connection}:${inbound.value.messageId}` : ""
            if (
                !(await this.inbox.claim("zalo", deliveryId, manager, {
                    insert: INSERT_ZALO_INBOX,
                    payload,
                }))
            )
                return
            const message: ZaloDeliveryRecorded = { deliveryId }
            await this.outbox.write(manager, ZALO_DELIVERY_QUEUE, message, {
                dedupeKey: `${ZALO_DELIVERY_QUEUE}:${deliveryId}`,
            })
        })
    }

    /** Resolves and processes a committed receipt atomically; retries leave a failed receipt pending. */
    processRecordedDelivery(message: ZaloDeliveryRecorded): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const [pending] = await manager.query<Array<PendingZaloReceipt>>(FIND_PENDING_ZALO_INBOX, [
                message.deliveryId,
            ])
            if (pending === undefined) return
            const rawBody = Buffer.from(pending.payload.rawBody, "utf8")
            const inbound = readZaloEvent(rawBody)
            if (inbound.kind === "ok")
                await this.conversations.acceptZalo(pending.payload.connection, inbound.value, manager)
            await manager.query(COMPLETE_ZALO_INBOX, [pending.id])
        })
    }
}
