import { InjectEntityInbox } from "@modules/platform/inbox"
import type { EntityInbox } from "@modules/platform/inbox"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import type { ZaloRawDelivery } from "./zalo-inbox.contracts"
import { ZALO_DELIVERY_QUEUE } from "@modules/queues/zalo-delivery"
import type { ZaloDeliveryRecorded } from "@modules/queues/zalo-delivery"
import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { ConversationsService, readZaloEvent } from "@modules/domain/conversations"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { zaloDeliveryIdOf } from "./zalo-delivery-id.policy"
import { ZaloInboxEntity } from "./persistence/entities"

@Injectable()
/** Claims each Zalo message once, then publishes its durable receipt; a deferred consumer stores it and queues its answer. */
export class ZaloInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly conversations: ConversationsService,
        @InjectEntityInbox() private readonly inbox: EntityInbox,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
    ) {}

    /** A redelivered message is acknowledged without being processed again; every event type has its own id, so a follow event is claimed once and never overwrites another. */
    acceptZaloDelivery(rawBody: ZaloRawDelivery, connection: string): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const payload = { connection, rawBody: rawBody?.toString("utf8") }
            const deliveryId = rawBody === undefined ? "" : zaloDeliveryIdOf(connection, rawBody)
            if (
                !(await this.inbox.claimRow("zalo", deliveryId, manager, {
                    entity: ZaloInboxEntity,
                    row: { provider: "zalo", deliveryId, payload },
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
            const pending = await manager.findOne(ZaloInboxEntity, {
                where: { provider: "zalo", deliveryId: message.deliveryId, processedAt: IsNull() },
                lock: { mode: "pessimistic_write" },
            })
            if (pending === null) return
            const rawBody = Buffer.from(pending.payload.rawBody, "utf8")
            const inbound = readZaloEvent(rawBody)
            if (inbound.kind === "ok")
                await this.conversations.acceptZalo(pending.payload.connection, inbound.value, manager)
            await manager.update(ZaloInboxEntity, { id: pending.id }, { processedAt: () => "now()" })
        })
    }
}
