import type { EntityManager } from "typeorm"
import type { ReceiptRow, WebhookJobRow, WebhookMessageRow } from "@tests/fixtures/persistence/proof.rows"
import type { MockOf } from "@starci/jest-preset"
import type { QueueOutboxService, QueueOutbox, QueueWriteOptions } from "@modules/platform/queue"
import { AccountDataIntakeService } from "@modules/domain/account-data"
import type { TelegramInboxService } from "@modules/domain/telegram-inbox"
import { persistReceiptAccount } from "../fixtures/builders/account-data.builder"
import { buildTelegramDelivery } from "../fixtures/builders/telegram-delivery.builder"
import type { LiteWorld } from "./lite-world.service"
import { cleanupWorkspace, deliveryEnvelopes, deliveryPublications, removeDeliveryOutbox } from "./proof-database.service"
import { receiptsOf, removeReceipts } from "./receipts-database.service"

/** The queue a Telegram delivery publishes to. */
const TELEGRAM_QUEUE = "telegram-delivery"

type TelegramDeliveryStateResultShape = {
    receipts: ReadonlyArray<ReceiptRow>
    jobs: Array<WebhookJobRow>
    messages: Array<WebhookMessageRow>
}

/** Observes committed inbox and outbox state using a separate transaction from intake. */
export const telegramDeliveryState = async (
    world: LiteWorld,
    deliveryId: string,
): Promise<TelegramDeliveryStateResultShape> => ({
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

type TelegramDeliveryBuilderResultMessageShape = {
    deliveryId: string
}

type TelegramDeliveryBuilderResultShape = {
    write: jest.SpyInstance<
        Promise<void>,
        [tx: EntityManager, queue: string, payload: object, options?: QueueWriteOptions | undefined]
    >
    service: TelegramInboxService
    message: TelegramDeliveryBuilderResultMessageShape
    actual: QueueOutboxService
    publication: MockOf<QueueOutbox>
    body: Buffer<ArrayBuffer>
    connection: string
    queueName: string
    close: () => Promise<void>
}

/**
 * Runs real domain intake and publication against the world database and registers resource cleanup. The receipt is a row of the
 * connection's account, so the owner, the workspace and the Telegram connection are persisted first (removing the workspace removes
 * the connection and its account rows).
 */
export const telegramDeliveryBuilder = async (world: LiteWorld): Promise<TelegramDeliveryBuilderResultShape> => {
    const userId = world.id()
    const workspaceId = world.id()
    const connection = world.id()
    cleanupWorkspace(world, userId, workspaceId)
    await persistReceiptAccount(world.db.primary, { userId, workspaceId, connectionId: connection, provider: "telegram" })
    const built = await buildTelegramDelivery(world.db.primary, connection, world.resolve(AccountDataIntakeService))
    cleanupTelegramDelivery(world, built.message.deliveryId)
    world.cleanup(built.close)
    return { ...built, write: jest.spyOn(built.actual, "write") }
}
