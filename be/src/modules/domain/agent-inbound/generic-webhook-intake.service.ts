import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectInbox, type Inbox } from "@modules/platform/inbox"
import { InjectGenericWebhookQueue, type GenericWebhookQueue } from "@modules/queues/generic-webhook"
import { GENERIC_WEBHOOK, receiveGenericWebhook } from "./generic-webhook.adapter"
import type { VerifiedDelivery } from "./agent-inbound-door.contracts"

@Injectable()
/**
 * Receives a verified webhook delivery and does nothing else. The delivery id is read out of the body (a body that is no event is refused),
 * claimed in the platform inbox first and, in the same transaction, the receipt is queued: the sender is answered as soon as the receipt is
 * written, and the job that reads the endpoint and wakes the agents runs after commit.
 */
export class GenericWebhookIntakeService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectGenericWebhookQueue() private readonly queue: GenericWebhookQueue,
    ) {}

    /** Records the receipt and queues its delivery; a redelivery of the same fact is acknowledged and queues nothing. */
    async accept(delivery: VerifiedDelivery): Promise<void> {
        await this.entityManager.transaction(async (tx) => {
            const received = receiveGenericWebhook(delivery)
            const deliveryId = received.deliveryId
            if (!(await this.inbox.claim(GENERIC_WEBHOOK, deliveryId, tx))) return
            await this.queue.enqueueDeliver(received.payload, tx)
        })
    }
}
