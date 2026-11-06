import { Test } from "@nestjs/testing"
import { fakeInbox, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { IsNull } from "typeorm"
import { ZaloWebhookGateService } from "@modules/domain/channels"
import { ConversationsService } from "@modules/domain/conversations"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { zaloInboxOf, zaloInboxWith, ZALO_TEXT_BODY } from "@tests/fixtures/builders/zalo-inbox.builder"
import { stampedValues } from "@tests/fixtures/builders/entity-row.builder"
import { parseJsonText } from "@modules/platform/primitives"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { ZaloInboxService } from "./zalo-inbox.service"
import { ZALO_DELIVERY_QUEUE } from "./zalo-inbox.contracts"
import { ZaloInboxEntity } from "./persistence/entities"

const body = Buffer.from(ZALO_TEXT_BODY)
const payload = { connection: "c-1", rawBody: ZALO_TEXT_BODY }

/** The value the deferred `processedAt` of an update stamps. */
const stamped = (set: unknown): unknown => {
    const processedAt: unknown = Reflect.get(Object(set), "processedAt")
    return typeof processedAt === "function" ? Reflect.apply(processedAt, undefined, []) : undefined
}

const build = async (pending: ZaloInboxEntity | null = zaloInboxOf(), claimed = true, keyed = true) => {
    const tx = fakeTransaction(
        mockEntityManager({
            findOne: [ZaloInboxEntity, pending],
            update: [ZaloInboxEntity, { affected: 1 }],
        }),
    )
    const conversations = mock<ConversationsService>()
    conversations.acceptZalo.mockResolvedValue(true)
    const inbox = fakeInbox()
    if (!claimed) inbox.seen("zalo", "c-1:m-1")
    const inboundEvents = mock<InboundEventsService>()
    const logger = mock<Logger>()
    const gate = mock<ZaloWebhookGateService>()
    gate.holdsProofKey.mockResolvedValue(keyed)
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloInboxService,
            { provide: INBOX, useValue: inbox },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: ConversationsService, useValue: conversations },
            { provide: InboundEventsService, useValue: inboundEvents },
            { provide: LOGGER, useValue: logger },
            { provide: ZaloWebhookGateService, useValue: gate },
        ],
    }).compile()
    return {
        service: moduleRef.get(ZaloInboxService),
        tx,
        conversations,
        outbox,
        write,
        inbox,
        gate,
        inboundEvents,
        logger,
    }
}

describe("ZaloInboxService receipt delivery", () => {
    it("claims the connection-prefixed message identity and defers conversation effects", async () => {
        const { service, conversations, write, inbox } = await build()
        await service.acceptZaloDelivery(body, "c-1")
        const manager = write.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(inbox.receipts.map(({ source, eventId, entity, row }) => ({ source, eventId, entity, row }))).toEqual([
            {
                source: "zalo",
                eventId: "c-1:m-1",
                entity: ZaloInboxEntity,
                row: { provider: "zalo", deliveryId: "c-1:m-1", payload },
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

    it("closes the receipt of a connection that holds no OA secret key yet, publishing nothing", async () => {
        const { service, outbox, tx, conversations, gate } = await build(zaloInboxOf(), true, false)
        await service.acceptZaloDelivery(body, "c-1")
        expect(gate.holdsProofKey).toHaveBeenCalledWith("c-1")
        expect(outbox.jobs).toEqual([])
        expect(stampedValues(tx.em.update.mock.calls[0]?.[2])).toEqual({ processedAt: "function", state: "handled" })
        expect(stamped(tx.em.update.mock.calls[0]?.[2])).toBe("now()")
        expect(tx.commits).toBe(1)
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
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
            return Promise.resolve(true)
        })
        await service.processRecordedDelivery({ deliveryId: "c-1:m-1" })
        expect(conversations.acceptZalo).toHaveBeenCalledTimes(1)
        expect(conversations.acceptZalo).toHaveBeenCalledWith(
            "c-1",
            { appId: "app-1", userId: "user-1", messageId: "m-1", text: "Hello", attachments: [], sentAt: null },
            conversations.acceptZalo.mock.calls[0]?.[2],
        )
        expect(tx.em.findOne).toHaveBeenCalledWith(ZaloInboxEntity, {
            where: { provider: "zalo", deliveryId: "c-1:m-1", processedAt: IsNull() },
            lock: { mode: "pessimistic_write" },
        })
        const [, , set] = tx.em.update.mock.calls[0] ?? []
        expect(stampedValues(set)).toEqual({ processedAt: "function", state: "handled" })
        const processedAt: unknown = Reflect.get(Object(set), "processedAt")
        const marked: unknown =
            typeof processedAt === "function" ? Reflect.apply(processedAt, undefined, []) : undefined
        expect(marked).toBe("now()")
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
    it("completes an ignored decoded message without a conversation effect, and logs that it was dropped", async () => {
        const { service, conversations, tx, logger } = await build(zaloInboxWith("{}"))
        await service.processRecordedDelivery({ deliveryId: "c-1:m-1" })
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
        expect(tx.em.update).toHaveBeenCalledTimes(1)
        expect(logger.info).toHaveBeenCalledWith("zalo_inbox.event_ignored", {
            connectionId: "c-1",
            eventName: "unreadable",
            reason: "CONVERSATIONS_NOT_ANSWERED",
        })
    })

    it("names the event it ignored, an image for one, and logs nothing for the text it answers", async () => {
        const image = JSON.stringify({ event_name: "user_send_image", sender: { id: "u" }, message: { msg_id: "m" } })
        const ignored = await build(zaloInboxWith(image))
        await ignored.service.processRecordedDelivery({ deliveryId: "c-1:m-1" })
        expect(ignored.logger.info).toHaveBeenCalledWith(
            "zalo_inbox.event_ignored",
            expect.objectContaining({ eventName: "user_send_image" }),
        )

        const answered = await build()
        await answered.service.processRecordedDelivery({ deliveryId: "c-1:m-1" })
        expect(answered.logger.info).not.toHaveBeenCalled()
    })

    it("leaves completion unwritten and rolls back a failed consumer", async () => {
        const { service, tx, conversations } = await build()
        const failure = new Error("conversation failed")
        conversations.acceptZalo.mockRejectedValue(failure)
        await expect(service.processRecordedDelivery({ deliveryId: "c-1:m-1" })).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
        expect(tx.em.findOne).toHaveBeenCalledTimes(1)
        expect(tx.em.update).toHaveBeenCalledTimes(1)
        expect(tx.em.update).toHaveBeenCalledWith(
            ZaloInboxEntity,
            { provider: "zalo", deliveryId: "c-1:m-1", processedAt: IsNull() },
            { state: "failed" },
        )
    })

    it("leaves a message that nobody was bound to answer as received", async () => {
        const { service, conversations, tx } = await build()
        conversations.acceptZalo.mockResolvedValue(false)
        await service.processRecordedDelivery({ deliveryId: "c-1:m-1" })
        expect(stampedValues(tx.em.update.mock.calls[0]?.[2])).toEqual({ processedAt: "function", state: "received" })
    })
})

describe("ZaloInboxService polled messages", () => {
    const message = { messageId: "m-1", userId: "user-1", text: "Hello", sentAt: 1_762_192_200_000 }
    const fresh = { workspaceId: "w-1", sender: "Bui Nguyen Dinh", stale: false }

    it("claims a fresh polled message under the webhook delivery id, tagged as a poll, and queues it like a webhook delivery", async () => {
        const { service, write, inbox, conversations } = await build()
        await expect(service.acceptPolledMessage("c-1", message, fresh)).resolves.toBe(true)
        expect(inbox.receipts[0]).toMatchObject({ source: "zalo", eventId: "c-1:m-1", entity: ZaloInboxEntity })
        expect(inbox.receipts[0]?.row).toMatchObject({
            deliveryId: "c-1:m-1",
            payload: { connection: "c-1", source: "poll" },
        })
        const stored: unknown = Reflect.get(Object(Reflect.get(Object(inbox.receipts[0]?.row), "payload")), "rawBody")
        const read = parseJsonText(typeof stored === "string" ? stored : "")
        expect(read.ok ? read.value : undefined).toEqual({
            event_name: "user_send_text",
            timestamp: "1762192200000",
            sender: { id: "user-1" },
            message: { msg_id: "m-1", text: "Hello" },
        })
        expect(write).toHaveBeenCalledWith(
            expect.anything(),
            ZALO_DELIVERY_QUEUE,
            { deliveryId: "c-1:m-1" },
            { dedupeKey: "zalo-delivery:c-1:m-1" },
        )
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
    })

    it("is a no-op for a message the webhook already delivered", async () => {
        const { service, outbox, inboundEvents } = await build(null, false)
        await expect(service.acceptPolledMessage("c-1", message, fresh)).resolves.toBe(false)
        expect(outbox.jobs).toEqual([])
        expect(inboundEvents.keepForOwner).not.toHaveBeenCalled()
    })

    it("closes a stale message as expired and keeps it for the owner without queueing an answer", async () => {
        const { service, outbox, tx, inboundEvents } = await build()
        await expect(service.acceptPolledMessage("c-1", message, { ...fresh, stale: true })).resolves.toBe(true)
        expect(outbox.jobs).toEqual([])
        expect(stampedValues(tx.em.update.mock.calls[0]?.[2])).toEqual({ processedAt: "function", state: "expired" })
        expect(stamped(tx.em.update.mock.calls[0]?.[2])).toBe("now()")
        expect(inboundEvents.keepForOwner).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "w-1",
            channel: "zalo",
            sender: "Bui Nguyen Dinh",
            body: "Hello",
            eventId: "zalo:c-1:m-1",
        })
    })
})

describe("ZaloInboxService non-text events", () => {
    it("claims a follow event under its own connection-scoped id and completes it without a conversation effect", async () => {
        const { service, conversations, write, inbox } = await build()
        const follow = JSON.stringify({ event_name: "follow", timestamp: "1700", follower: { id: "user-9" } })
        await service.acceptZaloDelivery(Buffer.from(follow), "c-1")
        expect(inbox.receipts[0]?.row).toMatchObject({ deliveryId: "c-1:follow:1700:user-9" })
        expect(write).toHaveBeenCalledWith(
            expect.anything(),
            ZALO_DELIVERY_QUEUE,
            { deliveryId: "c-1:follow:1700:user-9" },
            { dedupeKey: "zalo-delivery:c-1:follow:1700:user-9" },
        )
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
    })
})
