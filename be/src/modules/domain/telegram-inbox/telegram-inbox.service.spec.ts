import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { AccountDataIntakeService } from "@modules/domain/account-data"
import type { AccountWrite, PendingRow } from "@modules/domain/account-data"
import { CustomerFilesService } from "@modules/domain/chat-files"
import { ConnectionsService } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { ProviderTriggersService, type DeliverResult } from "@modules/domain/provider-triggers"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { TelegramFilesService } from "./telegram-files.service"
import { TELEGRAM_MESSAGE_WEBHOOK } from "./telegram-message.trigger"
import { TelegramInboxService } from "./telegram-inbox.service"
import { TELEGRAM_DELIVERY_QUEUE } from "./telegram-inbox.contracts"

/** A connection id as the doors scope a delivery by it. */
const CONNECTION = "0b1d52a4-8f3e-4c8a-9a64-4f0d2f6e7a11"
const owner = { provider: "telegram", connectionId: CONNECTION, workspaceId: "w-1" }
const NOW = new Date("2026-11-12T08:00:00.000Z")

const update = {
    update_id: 77,
    message: {
        message_id: 9,
        date: 1_762_850_000,
        chat: { id: 555 },
        text: "Hello",
        from: { id: 4242, username: "MinhNguyen", first_name: "Minh", last_name: "Nguyen" },
    },
}
const body = Buffer.from(JSON.stringify(update))

/** What the intake answers for a new update row. */
const writtenNew: AccountWrite = { owner, rows: [{ type: "telegram.update", key: "77", id: "row-1", isNew: true }] }

/** The pending update row of the account, holding the given raw body. */
const pendingOf = (raw: object = update): PendingRow => ({
    id: "row-1",
    type: "telegram.update",
    key: "77",
    owner,
    value: { updateId: "77", raw },
})

/** What the ONE delivery answers: the event delivered, and taken by a registered graph unless `untaken`. */
const deliveredOf = (untaken = 0): DeliverResult => ({ status: "delivered", events: 1, dropped: 0, woken: [], repeats: 0, untaken, held: 0 })

const build = async (written: AccountWrite = writtenNew, pending: PendingRow | null = pendingOf()) => {
    const tx = fakeTransaction(mockEntityManager({}))
    const triggers = mock<ProviderTriggersService>()
    triggers.deliver.mockResolvedValue(deliveredOf())
    const connections = mock<ConnectionsService>()
    connections.intakeOf.mockResolvedValue({ kind: "ok", value: { workspaceId: "w-1" } } as Awaited<ReturnType<ConnectionsService["intakeOf"]>>)
    connections.markReceived.mockResolvedValue(undefined)
    const customerFiles = mock<CustomerFilesService>()
    customerFiles.keep.mockImplementation((_workspace, _key, addresses) =>
        Promise.resolve(addresses.map((one, index) => ({ id: `f-${String(index)}`, url: `https://files.test/${one.url}`, name: one.name, contentType: "image/jpeg" }))),
    )
    const inboundEvents = mock<InboundEventsService>()
    const intake = mock<AccountDataIntakeService>()
    intake.write.mockResolvedValue(written)
    intake.lockPending.mockResolvedValue(pending)
    intake.complete.mockResolvedValue(undefined)
    const logger = mock<Logger>()
    const files = mock<TelegramFilesService>()
    files.addressesOf.mockImplementation((_connection, attachments) =>
        Promise.resolve(attachments.map((attachment) => ({ kind: attachment.kind, url: `https://tg.test/${attachment.fileId}`, name: attachment.name }))),
    )
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramInboxService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: ProviderTriggersService, useValue: triggers },
            { provide: ConnectionsService, useValue: connections },
            { provide: CustomerFilesService, useValue: customerFiles },
            { provide: InboundEventsService, useValue: inboundEvents },
            { provide: TelegramFilesService, useValue: files },
            { provide: AccountDataIntakeService, useValue: intake },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return {
        service: moduleRef.get(TelegramInboxService),
        tx,
        triggers,
        connections,
        customerFiles,
        inboundEvents,
        files,
        outbox,
        write,
        intake,
        logger,
    }
}

describe("TelegramInboxService receipt delivery", () => {
    it("writes the first receipt as a telegram.update row of the account and queues its consumer in the same transaction", async () => {
        const { service, triggers, write, intake } = await build()
        await service.acceptTelegramDelivery(body, CONNECTION)
        const manager = write.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(intake.write).toHaveBeenCalledWith(manager, CONNECTION, [
            { type: "telegram.update", value: { updateId: "77", raw: update } },
        ])
        expect(write).toHaveBeenCalledWith(
            manager,
            TELEGRAM_DELIVERY_QUEUE,
            { deliveryId: `${CONNECTION}:77` },
            { dedupeKey: `telegram-delivery:${CONNECTION}:77` },
        )
        expect(triggers.deliver).not.toHaveBeenCalled()
    })

    it("queues nothing for a redelivery: the row is not new", async () => {
        const redelivered: AccountWrite = { owner, rows: [{ type: "telegram.update", key: "77", id: "row-1", isNew: false }] }
        const { service, outbox, tx, triggers } = await build(redelivered)
        await service.acceptTelegramDelivery(body, CONNECTION)
        expect(outbox.jobs).toEqual([])
        expect(tx.commits).toBe(1)
        expect(triggers.deliver).not.toHaveBeenCalled()
    })

    it("keeps nothing for a connection nobody holds, and logs it once", async () => {
        const { service, outbox, logger } = await build({ owner: null, rows: [] })
        await service.acceptTelegramDelivery(body, CONNECTION)
        expect(outbox.jobs).toEqual([])
        expect(logger.warn).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith("telegram_inbox.unknown_connection", { connectionId: CONNECTION })
    })

    it("writes nothing for a delivery without a body or an update the chat does not answer", async () => {
        const { service, intake, outbox } = await build()
        await service.acceptTelegramDelivery(undefined, CONNECTION)
        await service.acceptTelegramDelivery(Buffer.from(JSON.stringify({ update_id: 79, edited_message: {} })), CONNECTION)
        expect(intake.write).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
    })

    it("rolls back the row if publication fails", async () => {
        const { service, tx, outbox } = await build()
        const failure = new Error("publication failed")
        outbox.failNext("write", failure)
        await expect(service.acceptTelegramDelivery(body, CONNECTION)).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
    })
})

describe("TelegramInboxService deferred effects", () => {
    it("locks the pending update, hands its message to the ONE delivery as the provider translates it, keeps the message and the person and completes, in one transaction", async () => {
        const { service, tx, triggers, intake, connections } = await build()
        await service.processRecordedDelivery({ deliveryId: `${CONNECTION}:77` })
        const manager = triggers.deliver.mock.calls[0]?.[1]
        expect(isTransactionManager(manager)).toBe(true)
        expect(intake.lockPending).toHaveBeenCalledWith(manager, "telegram.update", CONNECTION, "77")
        const at = new Date(1_762_850_000_000).toISOString()
        expect(triggers.deliver).toHaveBeenCalledWith(
            {
                workspaceId: "w-1",
                declaration: TELEGRAM_MESSAGE_WEBHOOK,
                connectionId: CONNECTION,
                agentId: null,
                events: [
                    {
                        event: {
                            id: "77",
                            subject: { channel: "telegram", id: "555", name: "Minh Nguyen" },
                            data: { messageKey: `tg:${CONNECTION}:555:9`, text: "Hello", at, attachments: [] },
                        },
                        raw: { type: "telegram.update", id: "row-1" },
                        occurredAt: at,
                    },
                ],
            },
            manager,
        )
        expect(connections.markReceived).toHaveBeenCalledWith(
            CONNECTION,
            { amount: 0, content: "Minh Nguyen", at: NOW.toISOString(), text: "Hello" },
            manager,
        )
        expect(intake.write).toHaveBeenCalledWith(manager, CONNECTION, [
            {
                type: "telegram.message",
                value: { chatId: "555", messageId: "9", userId: "4242", username: "minhnguyen", direction: "in", text: "Hello", at },
            },
            {
                type: "telegram.user",
                value: { userId: "4242", username: "minhnguyen", firstName: "Minh", lastName: "Nguyen", chatId: "555" },
            },
        ])
        expect(intake.complete).toHaveBeenCalledWith(manager, pendingOf())
        expect(tx.commits).toBe(1)
    })

    it("delivers /start as the message it is (its words, no start flag)", async () => {
        const start = { ...update, message: { ...update.message, text: "/start" } }
        const { service, triggers } = await build(undefined, pendingOf(start))
        await service.processRecordedDelivery({ deliveryId: `${CONNECTION}:77` })
        expect(triggers.deliver.mock.calls[0]?.[0].events[0]?.event.data).toEqual({
            messageKey: `tg:${CONNECTION}:555:9`,
            text: "/start",
            at: new Date(1_762_850_000_000).toISOString(),
            attachments: [],
        })
    })

    it("delivers the same event id for a replay of the same update", async () => {
        const { service, triggers } = await build()
        await service.processRecordedDelivery({ deliveryId: `${CONNECTION}:77` })
        await service.processRecordedDelivery({ deliveryId: `${CONNECTION}:77` })
        expect(triggers.deliver.mock.calls.map((call) => call[0].events.map((one) => one.event.id))).toEqual([["77"], ["77"]])
    })

    it("keeps a message no registered graph took for the owner, as an unrouted channel message", async () => {
        const { service, triggers, inboundEvents } = await build()
        triggers.deliver.mockResolvedValue(deliveredOf(1))
        await service.processRecordedDelivery({ deliveryId: `${CONNECTION}:77` })
        expect(inboundEvents.keepUnrouted).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "w-1",
            channel: "telegram",
            sender: "Minh Nguyen",
            body: "Hello",
            eventId: `tg:${CONNECTION}:555:9`,
        })
    })

    it("delivers nothing for a connection that is no live Telegram one, and still keeps the message for the account", async () => {
        const { service, triggers, connections, intake } = await build()
        connections.intakeOf.mockResolvedValue({ kind: "refused", code: "x" } as unknown as Awaited<ReturnType<ConnectionsService["intakeOf"]>>)
        await service.processRecordedDelivery({ deliveryId: `${CONNECTION}:77` })
        expect(triggers.deliver).not.toHaveBeenCalled()
        expect(intake.write).toHaveBeenCalledTimes(1)
        expect(intake.complete).toHaveBeenCalledTimes(1)
    })

    it("does nothing for an update that is absent or already completed", async () => {
        const { service, triggers, intake } = await build(undefined, null)
        await service.processRecordedDelivery({ deliveryId: `${CONNECTION}:77` })
        expect(triggers.deliver).not.toHaveBeenCalled()
        expect(intake.write).not.toHaveBeenCalled()
        expect(intake.complete).not.toHaveBeenCalled()
    })

    it("locks nothing for a delivery id that names no connection", async () => {
        const { service, intake } = await build()
        await service.processRecordedDelivery({ deliveryId: "c-1:77" })
        expect(intake.lockPending).not.toHaveBeenCalled()
    })

    it("completes an update that is not a message without a delivery or a kept row", async () => {
        const { service, triggers, intake } = await build(undefined, pendingOf({ update_id: 77 }))
        await service.processRecordedDelivery({ deliveryId: `${CONNECTION}:77` })
        expect(triggers.deliver).not.toHaveBeenCalled()
        expect(intake.write).not.toHaveBeenCalled()
        expect(intake.complete).toHaveBeenCalledTimes(1)
    })

    it("leaves the row pending and rethrows when the delivery fails", async () => {
        const { service, tx, triggers, intake } = await build()
        const failure = new Error("delivery failed")
        triggers.deliver.mockRejectedValue(failure)
        await expect(service.processRecordedDelivery({ deliveryId: `${CONNECTION}:77` })).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
        expect(intake.complete).not.toHaveBeenCalled()
    })
})

describe("TelegramInboxService photo messages", () => {
    it("labels a photo, asks Telegram for the largest one's address, keeps the bytes and hands them on as the event's files", async () => {
        const photo = {
            update_id: 80,
            message: {
                message_id: 11,
                date: 1_762_850_000,
                chat: { id: 555 },
                caption: "This one",
                photo: [
                    { file_id: "small", file_unique_id: "s", width: 90, height: 90 },
                    { file_id: "large", file_unique_id: "l", width: 1280, height: 960 },
                ],
            },
        }
        const { service, triggers, files, customerFiles } = await build(undefined, pendingOf(photo))
        await service.processRecordedDelivery({ deliveryId: `${CONNECTION}:80` })
        expect(files.addressesOf).toHaveBeenCalledWith(CONNECTION, [{ kind: "image", fileId: "large", name: "", size: null }])
        expect(customerFiles.keep).toHaveBeenCalledWith("w-1", `tg:${CONNECTION}:555:11`, [{ kind: "image", url: "https://tg.test/large", name: "" }])
        const [delivered] = triggers.deliver.mock.calls[0]?.[0].events ?? []
        expect(delivered?.event.data).toMatchObject({ text: "[Kh\u00e1ch g\u1eedi m\u1ed9t \u1ea3nh] This one" })
        expect(delivered?.event.subject).toEqual({ channel: "telegram", id: "555" })
        expect(delivered?.files).toEqual([{ id: "f-0", url: "https://files.test/https://tg.test/large", name: "", contentType: "image/jpeg" }])
    })
})
