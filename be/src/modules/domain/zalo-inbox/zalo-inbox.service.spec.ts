import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { IsNull } from "typeorm"
import { fakeRowInbox } from "@tests/fixtures/builders/row-claims.builder"
import { ConversationsService } from "@modules/domain/conversations"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { ZaloInboxService } from "./zalo-inbox.service"
import { ZALO_DELIVERY_QUEUE } from "./zalo-inbox.contracts"
import { ZaloInboxEntity } from "./persistence/entities"

const body = Buffer.from(
    JSON.stringify({
        app_id: "app-1",
        event_name: "user_send_text",
        sender: { id: "user-1" },
        message: { msg_id: "m-1", text: "Hello" },
    }),
)
const payload = { connection: "c-1", rawBody: body.toString("utf8") }

const pendingOf = (over: Partial<ZaloInboxEntity> = {}): ZaloInboxEntity =>
    Object.assign(new ZaloInboxEntity(), { id: "receipt-1", provider: "zalo", payload }, over)

const build = async (pending: ZaloInboxEntity | null = pendingOf(), claimed = true) => {
    const tx = fakeTransaction(
        mockEntityManager({
            findOne: [ZaloInboxEntity, pending],
            update: [ZaloInboxEntity, { affected: 1 }],
        }),
    )
    const conversations = mock<ConversationsService>()
    conversations.acceptZalo.mockResolvedValue(undefined)
    const inbox = fakeRowInbox(claimed)
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloInboxService,
            { provide: INBOX, useValue: inbox },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: ConversationsService, useValue: conversations },
        ],
    }).compile()
    return { service: moduleRef.get(ZaloInboxService), tx, conversations, outbox, write, rowClaims: inbox.rowClaims }
}

describe("ZaloInboxService receipt delivery", () => {
    it("claims the connection-prefixed message identity and defers conversation effects", async () => {
        const { service, conversations, write, rowClaims } = await build()
        await service.acceptZaloDelivery(body, "c-1")
        const manager = write.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(rowClaims).toEqual([
            {
                source: "zalo",
                eventId: "c-1:m-1",
                receipt: { entity: ZaloInboxEntity, row: { provider: "zalo", deliveryId: "c-1:m-1", payload } },
            },
        ])
        expect(write).toHaveBeenCalledWith(
            manager,
            ZALO_DELIVERY_QUEUE,
            { deliveryId: "c-1:m-1" },
            { dedupeKey: "zalo-delivery:c-1:m-1" },
        )
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
    })

    it("does not publish duplicates", async () => {
        const { service, outbox, tx, conversations } = await build(null, false)
        await service.acceptZaloDelivery(body, "c-1")
        expect(outbox.jobs).toEqual([])
        expect(tx.commits).toBe(1)
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
    })

    it("ignores unreadable deliveries without a claim", async () => {
        const { service, tx, outbox } = await build()
        await service.acceptZaloDelivery(undefined, "c-1")
        expect(tx.em.findOne).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
    })

    it("rolls back the intake if publication fails", async () => {
        const { service, tx, outbox } = await build()
        const failure = new Error("publication failed")
        outbox.failNext("write", failure)
        await expect(service.acceptZaloDelivery(body, "c-1")).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
    })
})

describe("ZaloInboxService deferred effects", () => {
    it("locks the pending receipt and completes it after the conversation effect", async () => {
        const { service, tx, conversations } = await build()
        conversations.acceptZalo.mockImplementation((_connection, _message, manager) => {
            expect(isTransactionManager(manager)).toBe(true)
            expect(tx.em.findOne).toHaveBeenCalledTimes(1)
            expect(tx.em.update).not.toHaveBeenCalled()
            return Promise.resolve()
        })
        await service.processRecordedDelivery({ deliveryId: "c-1:m-1" })
        expect(conversations.acceptZalo).toHaveBeenCalledTimes(1)
        expect(conversations.acceptZalo).toHaveBeenCalledWith(
            "c-1",
            { appId: "app-1", userId: "user-1", messageId: "m-1", text: "Hello" },
            conversations.acceptZalo.mock.calls[0]?.[2],
        )
        expect(tx.em.findOne).toHaveBeenCalledWith(ZaloInboxEntity, {
            where: { provider: "zalo", deliveryId: "c-1:m-1", processedAt: IsNull() },
            lock: { mode: "pessimistic_write" },
        })
        expect(tx.em.update).toHaveBeenCalledWith(
            ZaloInboxEntity,
            { id: "receipt-1" },
            { processedAt: expect.any(Function) },
        )
        expect(tx.commits).toBe(1)
    })

    it("does not repeat a missing or completed receipt", async () => {
        const { service, conversations, tx } = await build(null)
        await service.processRecordedDelivery({ deliveryId: "c-1:m-1" })
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
        expect(tx.em.findOne).toHaveBeenCalledTimes(1)
        expect(tx.em.update).not.toHaveBeenCalled()
    })
})

describe("ZaloInboxService consumer recovery", () => {
    it("completes an ignored decoded message without a conversation effect", async () => {
        const { service, conversations, tx } = await build(pendingOf({ payload: { connection: "c-1", rawBody: "{}" } }))
        await service.processRecordedDelivery({ deliveryId: "c-1:m-1" })
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
        expect(tx.em.update).toHaveBeenCalledTimes(1)
    })

    it("leaves completion unwritten and rolls back a failed consumer", async () => {
        const { service, tx, conversations } = await build()
        const failure = new Error("conversation failed")
        conversations.acceptZalo.mockRejectedValue(failure)
        await expect(service.processRecordedDelivery({ deliveryId: "c-1:m-1" })).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
        expect(tx.em.findOne).toHaveBeenCalledTimes(1)
        expect(tx.em.update).not.toHaveBeenCalled()
    })
})

describe("ZaloInboxService non-text events", () => {
    it("claims a follow event under its own connection-scoped id and completes it without a conversation effect", async () => {
        const { service, conversations, write, rowClaims } = await build()
        const follow = JSON.stringify({ event_name: "follow", timestamp: "1700", follower: { id: "user-9" } })
        await service.acceptZaloDelivery(Buffer.from(follow), "c-1")
        expect(rowClaims[0]?.receipt.row).toMatchObject({ deliveryId: "c-1:follow:1700:user-9" })
        expect(write).toHaveBeenCalledWith(
            expect.anything(),
            ZALO_DELIVERY_QUEUE,
            { deliveryId: "c-1:follow:1700:user-9" },
            { dedupeKey: "zalo-delivery:c-1:follow:1700:user-9" },
        )
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
    })
})
