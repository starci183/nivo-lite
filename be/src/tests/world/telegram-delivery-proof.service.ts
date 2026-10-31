import { buildTelegramDelivery } from "../fixtures/builders/telegram-delivery.builder"
import type { LiteWorld } from "./lite-world.service"
import { deliveryEnvelopes, deliveryPublications, removeDeliveryOutbox } from "./proof-database.service"
import { receiptsOf, removeReceipts } from "./receipts-database.service"

/** The queue a Telegram delivery publishes to. */
const TELEGRAM_QUEUE = "telegram-delivery"

/** Observes committed inbox and outbox state using a separate transaction from intake. */
export const telegramDeliveryState = async (world: LiteWorld, deliveryId: string) => ({
    receipts: await receiptsOf(world.db.primary, "telegram", deliveryId),
    jobs: await deliveryPublications(world.db.primary, TELEGRAM_QUEUE, deliveryId),
    messages: await deliveryEnvelopes(world.db.primary, TELEGRAM_QUEUE, deliveryId),
})
/** Registers isolated proof cleanup in dependency order. */
export const cleanupTelegramDelivery = (world: LiteWorld, deliveryId: string): void => {
    world.cleanup(async () => {
        await removeDeliveryOutbox(world.db.primary, TELEGRAM_QUEUE, deliveryId)
        await removeReceipts(world.db.primary, "telegram", deliveryId)
    })
}

/** Runs real domain intake and publication against the world database and registers resource cleanup. */
export const telegramDeliveryBuilder = async (world: LiteWorld) => {
    const connection = world.key(world.id())
    const built = await buildTelegramDelivery(world.db.primary, connection)
    cleanupTelegramDelivery(world, built.message.deliveryId)
    world.cleanup(built.close)
    return { ...built, write: jest.spyOn(built.actual, "write") }
}
