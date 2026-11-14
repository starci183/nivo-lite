import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AccountDataIntakeService } from "@modules/domain/account-data"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectGenericWebhookQueue, type GenericWebhookQueue } from "@modules/queues/generic-webhook"
import { receiveGenericWebhook } from "./generic-webhook.adapter"
import { webhookDeliveryOf } from "./generic-webhook-intake.policy"
import type { VerifiedDelivery } from "./agent-inbound-door.contracts"

@Injectable()
/**
 * Receives a verified webhook delivery and does nothing else. The delivery id is read out of the body (a body that is no event is refused),
 * the delivery is written once as a `webhook.delivery` row of the endpoint's account (its unique key is the dedupe) and, in the same
 * transaction, the receipt is queued: the sender is answered as soon as the row is written, and the job that reads the endpoint and wakes
 * the agents runs after commit.
 */
export class GenericWebhookIntakeService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly intake: AccountDataIntakeService,
        @InjectGenericWebhookQueue() private readonly queue: GenericWebhookQueue,
    ) {}

    /** Records the receipt and queues its delivery; a redelivery of the same fact, or an endpoint nobody holds, queues nothing. */
    async accept(delivery: VerifiedDelivery): Promise<void> {
        const received = receiveGenericWebhook(delivery)
        const claim = webhookDeliveryOf(received.payload)
        await this.entityManager.transaction(async (tx) => {
            const claimed = await this.intake.claim(tx, claim)
            if (claimed === undefined) return
            await this.queue.enqueueDeliver(received.payload, tx)
        })
    }
}
