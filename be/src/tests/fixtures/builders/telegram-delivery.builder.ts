import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConversationsService } from "@modules/domain/conversations"
import { TelegramInboxService } from "@modules/domain/telegram-inbox"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { Logger } from "@modules/platform/logging"
import {
    PgmqQueueTransportClient,
    QUEUE_OUTBOX,
    QueueOutboxService,
    type QueueOptions,
    type QueueOutbox,
} from "@modules/platform/queue"
import type { EntityManager } from "typeorm"
import {
    TelegramDeliveryQueue,
    isTelegramDeliveryRecorded,
    TELEGRAM_DELIVERY_QUEUE,
} from "@modules/queues/telegram-delivery"

/** The provider bytes and durable identity used by Telegram publication proofs. */
export const telegramDeliveryInput = (connection: string) => {
    const message = { deliveryId: `${connection}:77` }
    const body = Buffer.from(
        JSON.stringify({
            update_id: 77,
            message: { message_id: 9, chat: { id: 555 }, text: "Hello", from: { first_name: "Minh" } },
        }),
    )
    return { body, message }
}

/** Exercises the queue producer as the domain intake's publication adapter over real inbox/outbox transactions. */
export const buildTelegramDelivery = async (manager: EntityManager, queueOptions: QueueOptions, connection: string) => {
    const { body, message } = telegramDeliveryInput(connection)
    const transport = new PgmqQueueTransportClient(queueOptions, manager, mock<Logger>())
    const actual = new QueueOutboxService(transport)
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
