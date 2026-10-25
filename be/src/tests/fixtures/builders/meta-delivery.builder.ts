import { QueueOutboxService } from "@modules/platform/queue"
import { MetaDeliveryQueue } from "@modules/queues/meta-delivery"

/** Observes the real queue producer over the world's caller-owned database transaction. */
export const buildMetaDelivery = () => {
    const outbox = new QueueOutboxService()
    return { queue: new MetaDeliveryQueue(outbox), outbox }
}
