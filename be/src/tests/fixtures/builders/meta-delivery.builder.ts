import { QueueOutboxService } from "@modules/platform/queue"
import { MetaDeliveryQueue } from "@modules/queues/meta-delivery"

type BuildMetaDeliveryResultShape = {
    queue: MetaDeliveryQueue
    outbox: QueueOutboxService
}

/** Observes the real queue producer over the world's caller-owned database transaction. */
export const buildMetaDelivery = (): BuildMetaDeliveryResultShape => {
    const outbox = new QueueOutboxService()
    return { queue: new MetaDeliveryQueue(outbox), outbox }
}
