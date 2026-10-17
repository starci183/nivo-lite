import { queueOptions } from "./test-capabilities.options"

import { buildTelegramDelivery } from "../fixtures/builders/telegram-delivery.builder"
import type { LiteWorld } from "./lite-world.service"
import type { ReceiptRow, WebhookJobRow, WebhookMessageRow } from "../fixtures/persistence/proof.rows"
import * as statements from "../fixtures/builders/telegram-delivery.sql"

/** Observes committed inbox, outbox and pgmq state using a separate transaction from intake. */
export const telegramDeliveryState = async (world: LiteWorld, deliveryId: string) => ({
    receipts: await world.db.primary.query<Array<ReceiptRow>>(statements.RECEIPTS, [deliveryId]),
    jobs: await world.db.primary.query<Array<WebhookJobRow>>(statements.JOBS, [deliveryId]),
    messages: await world.db.primary.query<Array<WebhookMessageRow>>(statements.MESSAGES, [deliveryId]),
})
/** Registers isolated proof cleanup in dependency order. */
export const cleanupTelegramDelivery = (world: LiteWorld, deliveryId: string): void => {
    world.cleanup(async () => {
        await world.db.primary.query(statements.CLEAN_MESSAGES, [deliveryId])
        await world.db.primary.query(statements.CLEAN_JOBS, [deliveryId])
        await world.db.primary.query(statements.CLEAN_RECEIPTS, [deliveryId])
    })
}

/** Runs real domain intake and publication against the world database and registers resource cleanup. */
export const telegramDeliveryBuilder = async (world: LiteWorld) => {
    const connection = world.key(world.id())
    const built = await buildTelegramDelivery(world.db.primary, queueOptions, connection)
    cleanupTelegramDelivery(world, built.message.deliveryId)
    world.cleanup(built.close)
    return { ...built, write: jest.spyOn(built.actual, "write") }
}
