import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { IsNull } from "typeorm"
import { fakeRowInbox } from "@tests/fixtures/builders/row-claims.builder"
import { ConversationsService } from "@modules/domain/conversations"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { TelegramInboxService } from "./telegram-inbox.service"
import { TELEGRAM_DELIVERY_QUEUE } from "./telegram-inbox.contracts"
import { TelegramInboxEntity } from "./persistence/entities"

const body = Buffer.from(
    JSON.stringify({
        update_id: 77,
        message: { message_id: 9, chat: { id: 555 }, text: "Hello", from: { first_name: "Minh" } },
    }),
)
const payload = { connection: "c-1", rawBody: body.toString("utf8") }

const pendingOf = (over: Partial<TelegramInboxEntity> = {}): TelegramInboxEntity =>
    Object.assign(new TelegramInboxEntity(), { id: "receipt-1", provider: "telegram", payload }, over)

const build = async (pending: TelegramInboxEntity | null = pendingOf(), claimed = true) => {
    const tx = fakeTransaction(
        mockEntityManager({
            findOne: [TelegramInboxEntity, pending],
            update: [TelegramInboxEntity, { affected: 1 }],
        }),
    )
    const conversations = mock<ConversationsService>()
    conversations.acceptTelegram.mockResolvedValue(undefined)
    const inbox = fakeRowInbox(claimed)
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramInboxService,
            { provide: INBOX, useValue: inbox },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: ConversationsService, useValue: conversations },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => key) }) },
        ],
    }).compile()
    return {
        service: moduleRef.get(TelegramInboxService),
        tx,
        conversations,
        outbox,
        write,
        rowClaims: inbox.rowClaims,
    }
}

describe("TelegramInboxService receipt delivery", () => {
    it("claims the connection-prefixed message identity and defers conversation effects", async () => {
        const { service, conversations, write, rowClaims } = await build()
        await service.acceptTelegramDelivery(body, "c-1")
        const manager = write.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(rowClaims).toEqual([
            {
                source: "telegram",
                eventId: "c-1:77",
                receipt: { entity: TelegramInboxEntity, row: { provider: "telegram", deliveryId: "c-1:77", payload } },
            },
        ])
        expect(write).toHaveBeenCalledWith(
            manager,
            TELEGRAM_DELIVERY_QUEUE,
            { deliveryId: "c-1:77" },
            { dedupeKey: "telegram-delivery:c-1:77" },
        )
        expect(conversations.acceptTelegram).not.toHaveBeenCalled()
    })

    it("does not publish duplicates", async () => {
        const { service, outbox, tx, conversations } = await build(null, false)
        await service.acceptTelegramDelivery(body, "c-1")
        expect(outbox.jobs).toEqual([])
        expect(tx.commits).toBe(1)
        expect(conversations.acceptTelegram).not.toHaveBeenCalled()
    })

    it("ignores unreadable deliveries without a claim", async () => {
        const { service, tx, outbox } = await build()
        await service.acceptTelegramDelivery(undefined, "c-1")
        expect(tx.em.findOne).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
    })

    it("rolls back the intake if publication fails", async () => {
        const { service, tx, outbox } = await build()
        const failure = new Error("publication failed")
        outbox.failNext("write", failure)
        await expect(service.acceptTelegramDelivery(body, "c-1")).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
    })
})

describe("TelegramInboxService deferred effects", () => {
    it("locks the pending receipt and completes it after the conversation effect", async () => {
        const { service, tx, conversations } = await build()
        conversations.acceptTelegram.mockImplementation((_connection, _message, manager) => {
            expect(isTransactionManager(manager)).toBe(true)
            expect(tx.em.findOne).toHaveBeenCalledTimes(1)
            expect(tx.em.update).not.toHaveBeenCalled()
            return Promise.resolve()
        })
        await service.processRecordedDelivery({ deliveryId: "c-1:77" })
        expect(conversations.acceptTelegram).toHaveBeenCalledTimes(1)
        expect(conversations.acceptTelegram).toHaveBeenCalledWith(
            "c-1",
            { updateId: 77, chatId: "555", messageId: 9, text: "Hello", visitor: "Minh", isStart: false },
            conversations.acceptTelegram.mock.calls[0]?.[2],
        )
        expect(tx.em.findOne).toHaveBeenCalledWith(TelegramInboxEntity, {
            where: { provider: "telegram", deliveryId: "c-1:77", processedAt: IsNull() },
            lock: { mode: "pessimistic_write" },
        })
        expect(tx.em.update).toHaveBeenCalledWith(
            TelegramInboxEntity,
            { id: "receipt-1" },
            { processedAt: expect.any(Function) },
        )
        expect(tx.commits).toBe(1)
    })

    it("does not repeat a missing or completed receipt", async () => {
        const { service, conversations, tx } = await build(null)
        await service.processRecordedDelivery({ deliveryId: "c-1:77" })
        expect(conversations.acceptTelegram).not.toHaveBeenCalled()
        expect(tx.em.findOne).toHaveBeenCalledTimes(1)
        expect(tx.em.update).not.toHaveBeenCalled()
    })
})

describe("TelegramInboxService consumer recovery", () => {
    it("completes an ignored decoded message without a conversation effect", async () => {
        const { service, conversations, tx } = await build(pendingOf({ payload: { connection: "c-1", rawBody: "{}" } }))
        await service.processRecordedDelivery({ deliveryId: "c-1:77" })
        expect(conversations.acceptTelegram).not.toHaveBeenCalled()
        expect(tx.em.update).toHaveBeenCalledTimes(1)
    })

    it("leaves completion unwritten and rolls back a failed consumer", async () => {
        const { service, tx, conversations } = await build()
        const failure = new Error("conversation failed")
        conversations.acceptTelegram.mockRejectedValue(failure)
        await expect(service.processRecordedDelivery({ deliveryId: "c-1:77" })).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
        expect(tx.em.findOne).toHaveBeenCalledTimes(1)
        expect(tx.em.update).not.toHaveBeenCalled()
    })
})

describe("TelegramInboxService ignored events", () => {
    it("acknowledges an unsupported event without claiming or processing it", async () => {
        const { service, tx, conversations, outbox } = await build()
        await service.acceptTelegramDelivery(Buffer.from(JSON.stringify({ update_id: 79, edited_message: {} })), "c-1")
        expect(tx.em.findOne).not.toHaveBeenCalled()
        expect(conversations.acceptTelegram).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
    })
})

describe("TelegramInboxService photo messages", () => {
    it("labels a deferred photo with the localized text in brackets", async () => {
        const photo = JSON.stringify({
            update_id: 78,
            message: { message_id: 10, chat: { id: 555 }, photo: [{}], caption: "Paid" },
        })
        const { service, conversations } = await build(pendingOf({ payload: { connection: "c-1", rawBody: photo } }))
        await service.processRecordedDelivery({ deliveryId: "c-1:78" })
        expect(conversations.acceptTelegram).toHaveBeenCalledWith(
            "c-1",
            expect.objectContaining({ text: "[conversations.photoSent] Paid" }),
            conversations.acceptTelegram.mock.calls[0]?.[2],
        )
    })
})
