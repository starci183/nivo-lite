import { Test } from "@nestjs/testing"
import { mock, type MockOf } from "@starci/jest-preset"
import { ConversationsService } from "@modules/domain/conversations"
import { TelegramInboxService } from "@modules/domain/telegram-inbox"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { QUEUE_OUTBOX, QueueOutboxService, type QueueOutbox } from "@modules/platform/queue"
import type { EntityManager } from "typeorm"
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

/** The provider bytes and durable identity used by Telegram publication proofs. */
export const telegramDeliveryInput = (connection: string): TelegramDeliveryInputResultShape => {
    const message = { deliveryId: `${connection}:77` }
    const body = Buffer.from(
        JSON.stringify({
            update_id: 77,
            message: { message_id: 9, chat: { id: 555 }, text: "Hello", from: { first_name: "Minh" } },
        }),
    )
    return { body, message }
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

/** Exercises the queue producer as the domain intake's publication adapter over real inbox/outbox transactions. */
export const buildTelegramDelivery = async (
    manager: EntityManager,
    connection: string,
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
            { provide: INBOX, useClass: InboxService },
            { provide: QUEUE_OUTBOX, useValue: publication },
            { provide: ConversationsService, useValue: mock<ConversationsService>() },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
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
