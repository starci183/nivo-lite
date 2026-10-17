import { mock } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { PgmqQueueTransportClient, QueueOutboxService } from "@modules/platform/queue"
import type { QueueOptions } from "@modules/platform/queue"
import type { Logger } from "@modules/platform/logging"
import { MetaDeliveryQueue } from "@modules/queues/meta-delivery"

/** Observes the real queue producer over the world's caller-owned database transaction. */
export const buildMetaDelivery = (manager: EntityManager, options: QueueOptions) => {
    const transport = new PgmqQueueTransportClient(options, manager, mock<Logger>())
    const outbox = new QueueOutboxService(transport)
    return { queue: new MetaDeliveryQueue(outbox), outbox }
}
