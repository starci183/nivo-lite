import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { GENERIC_WEBHOOK_QUEUE, GenericWebhookJob, genericWebhookKey } from "./generic-webhook.contracts"
import type { GenericWebhookPayload } from "./generic-webhook.contracts"

@Injectable()
/** Queues a verified receipt in the intake transaction, preserving its delivery identity through the relay. */
export class GenericWebhookQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** The delivery job commits with its inbox receipt; redelivery keeps the same durable job identity. */
    enqueueDeliver(payload: GenericWebhookPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, GENERIC_WEBHOOK_QUEUE, payload, {
            job: GenericWebhookJob.Deliver,
            dedupeKey: genericWebhookKey(payload.deliveryId),
        })
    }
}
