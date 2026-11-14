import { Test } from "@nestjs/testing"
import { FakeClock, mock, type MockOf } from "@starci/jest-preset"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { TelegramInboxService } from "@modules/domain/telegram-inbox"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { MESSAGE_CATALOG, type MessageCatalog } from "@modules/platform/i18n"
import { QUEUE_OUTBOX, QueueOutboxService, type QueueOutbox } from "@modules/platform/queue"
import type { EntityManager } from "typeorm"
import { AccountDataIntakeService } from "@modules/domain/account-data"
import {
    TelegramDeliveryQueue,
    isTelegramDeliveryRecorded,
    TELEGRAM_DELIVERY_QUEUE,
} from "@modules/queues/telegram-delivery"

type TelegramDeliveryInputResultMessageShape = {
    deliveryId: string
}

type TelegramDeliveryInputResultShape = {
    body: Buffer<ArrayBuffer>
    message: TelegramDeliveryInputResultMessageShape
}

/** The update every Telegram publication proof receives, as the `raw` of its `telegram.update` row keeps it. */
export const TELEGRAM_PROOF_UPDATE = {
    update_id: 77,
    message: { message_id: 9, chat: { id: 555 }, text: "Hello", from: { first_name: "Minh" } },
}

/** The provider bytes and durable identity used by Telegram publication proofs. */
export const telegramDeliveryInput = (connection: string): TelegramDeliveryInputResultShape => {
    const message = { deliveryId: `${connection}:77` }
    return { body: Buffer.from(JSON.stringify(TELEGRAM_PROOF_UPDATE)), message }
}


type BuildTelegramDeliveryResultShape = {
    service: TelegramInboxService
    message: TelegramDeliveryInputResultMessageShape
    actual: QueueOutboxService
    publication: MockOf<QueueOutbox>
    body: Buffer<ArrayBuffer>
    connection: string
    queueName: string
    close: () => Promise<void>
}

/**
 * Exercises the queue producer as the domain intake's publication adapter over real account-data/outbox transactions: the receipt is the
 * real `telegram.update` row of the connection's account (written by the world's intake), so the connection must be persisted.
 */
export const buildTelegramDelivery = async (
    manager: EntityManager,
    connection: string,
    intake: AccountDataIntakeService,
): Promise<BuildTelegramDeliveryResultShape> => {
    const { body, message } = telegramDeliveryInput(connection)
    const actual = new QueueOutboxService()
    const queue = new TelegramDeliveryQueue(actual)
    const publication = mock<QueueOutbox>()
    publication.write.mockImplementation((tx, _name, payload) => {
        if (!isTelegramDeliveryRecorded(payload)) return Promise.resolve()
        return queue.enqueueDeliveryRecorded(payload, tx)
    })
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key) => key)
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramInboxService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: AccountDataIntakeService, useValue: intake },
            { provide: QUEUE_OUTBOX, useValue: publication },
            { provide: ProviderTriggersService, useValue: mock<ProviderTriggersService>() },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: CLOCK, useValue: new FakeClock("2026-11-12T00:00:00.000Z") },
        ],
    })
        // The picture lookup of the consumer is the only other collaborator; publication never reaches it.
        .useMocker(() => ({}))
        .compile()
    return {
        service: moduleRef.get(TelegramInboxService),
        message,
        actual,
        publication,
        body,
        connection,
        queueName: TELEGRAM_DELIVERY_QUEUE,
        close: () => moduleRef.close(),
    }
}
