import type { EntityManager } from "typeorm"
import { GENERIC_WEBHOOK_QUEUE, GenericWebhookQueueModule } from "@modules/queues/generic-webhook"
import type { GenericWebhookPayload } from "@modules/queues/generic-webhook"
import type { LiteWorld } from "./lite-world.service"
import { QUEUE_MODULES } from "./test-capabilities.options"
import { deliveryPublications } from "./proof-database.service"
import type { DynamicModule } from "@nestjs/common"

/** The real transactional outbox and its generic webhook producer, with the relay idle during database proofs. */
export const GENERIC_WEBHOOK_QUEUE_MODULES: Array<DynamicModule> = [
    ...QUEUE_MODULES,
    GenericWebhookQueueModule.register({}),
]

/** Reads committed delivery state through the world's observer connection while the producer transaction remains open. */
export const observeCommittedWebhookDelivery = (
    world: LiteWorld,
    payload: GenericWebhookPayload,
): ReturnType<typeof deliveryPublications> =>
    deliveryPublications(world.db.primary, GENERIC_WEBHOOK_QUEUE, payload.deliveryId)

/** A real transaction manager whose connection has closed, so a publication fails at the actual database boundary. */
export const releasedTransactionOf = async (world: LiteWorld): Promise<EntityManager> => {
    const runner = world.db.primary.connection.createQueryRunner()
    await runner.connect()
    try {
        await runner.startTransaction()
        await runner.rollbackTransaction()
    } finally {
        await runner.release()
    }
    return runner.manager
}
