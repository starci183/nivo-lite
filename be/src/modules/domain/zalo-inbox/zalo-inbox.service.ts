import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConversationsService, readZaloEvent } from "@modules/domain/conversations"
import { acceptWebhookDelivery, InjectPrimaryEntityManager } from "@modules/platform/database"
import { COMPLETE_ZALO_INBOX, INSERT_ZALO_INBOX } from "./persistence/zalo-inbox.sql"

@Injectable()
/** Claims each Zalo message once, then stores it and enqueues its answer in the same transaction. */
export class ZaloInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly conversations: ConversationsService,
    ) {}

    /** A redelivered message is acknowledged without being processed again; an event that is not a customer text is acknowledged and dropped. */
    async acceptZaloDelivery(connectionId: string, rawBody?: Buffer): Promise<void> {
        const inbound = readZaloEvent(rawBody)
        if (inbound.kind !== "ok") return
        const event = inbound.value
        await acceptWebhookDelivery({
            entityManager: this.entityManager,
            insert: INSERT_ZALO_INBOX,
            complete: COMPLETE_ZALO_INBOX,
            provider: "zalo",
            deliveryId: `${connectionId}:${event.messageId}`,
            payload: { connectionId, messageId: event.messageId },
            process: (manager) => this.conversations.acceptZalo(connectionId, event, manager),
        })
    }
}
