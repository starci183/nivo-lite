import { evaluatedCalls } from "@tests/fixtures/builders/evaluated-calls.builder"
import {
    replayReceiptBody,
    expectedSurfaceLookups,
    expectedMessageRecords,
    expectedCommentRecords,
    expectedUnownedLookups,
    surfaceEventCalls,
    directMessageCalls,
    expectedMessageJobs,
    expectedCommentJobs,
    expectedThreadWindows,
    expectedCommentWindows,
    dm,
    postback,
    comment,
    mention,
    missingWindowEvents,
    unownedSurfaceEvents,
    BODY,
    RAW_BODY,
    DELIVERY_ID,
    SIGNATURE,
    AT,
    OWNER,
    event,
    unreadableReceipts,
    directMessages,
    ignoredMessages,
} from "@tests/fixtures/builders/meta-inbox.builder"
import { fakeInbox, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { FakeTransaction } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { IsNull } from "typeorm"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import { ConversationsService } from "@modules/domain/conversations"
import { MetaCommentsService } from "@modules/domain/meta-comments"
import { MetaThreadsService } from "@modules/domain/meta-threads"
import { MetaReceiptPolicy } from "./meta-receipt.policy"
import { parseWebhook } from "@modules/integrations/meta"
import type { MetaClient, MetaEvent } from "@modules/integrations/meta"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { META_INBOUND_QUEUE, META_DELIVERY_QUEUE } from "./meta-inbox.contracts"
import { META_EVENT_TAKER } from "./meta-inbox.decorators"
import type { MetaEventTaker } from "./meta-inbox.port"
import type { MetaInboundJob } from "./meta-inbox.contracts"
import { MetaInboxService } from "./meta-inbox.service"
import { MetaInboxEntity } from "./persistence/entities"

const FIND_CALL = [
    MetaInboxEntity,
    {
        select: { id: true, payload: true },
        where: { provider: "meta", deliveryId: DELIVERY_ID, processedAt: IsNull() },
        lock: { mode: "pessimistic_write" },
    },
]
const RECEIPT_CLAIM = {
    source: "meta",
    eventId: DELIVERY_ID,
    entity: MetaInboxEntity,
    row: { provider: "meta", deliveryId: DELIVERY_ID, payload: BODY },
}
const COMPLETE_CALL = ["MetaInboxEntity", { id: "inbox-1" }, { processedAt: "now()" }]

const pendingReceipt = (payload: object) => Object.assign(new MetaInboxEntity(), { id: "inbox-1", payload })

/** The consumer locked the pending receipt and then completed it. */
const expectConsumed = (tx: FakeTransaction): void => {
    expect(tx.em.findOne.mock.calls).toEqual([FIND_CALL])
    expect(evaluatedCalls(tx.em.update.mock.calls, 2)).toEqual([COMPLETE_CALL])
}

/** The consumer locked the pending receipt and wrote no completion. */
const expectLockedOnly = (tx: FakeTransaction): void => {
    expect(tx.em.findOne.mock.calls).toEqual([FIND_CALL])
    expect(tx.em.update).not.toHaveBeenCalled()
}

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

const build = async (
    events: ReadonlyArray<MetaEvent> = [],
    claimed = true,
    pending: MetaInboxEntity | null = pendingReceipt(BODY),
    realParsing = false,
) => {
    const tx = fakeTransaction(
        mockEntityManager({
            findOne: [MetaInboxEntity, pending],
            update: [MetaInboxEntity, {}],
        }),
    )
    const connections = mock<ConnectionsService>()
    connections.findLiveByMeta.mockResolvedValue(OWNER)
    const meta = mock<MetaClient>()
    meta.verifyDelivery.mockReturnValue(true)
    meta.parse.mockReturnValue([...events])
    if (realParsing) meta.parse.mockImplementation((body) => parseWebhook(body, Date.parse(AT)))
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const conversations = mock<ConversationsService>()
    const threads = mock<MetaThreadsService>()
    threads.touch.mockResolvedValue(undefined)
    const comments = mock<MetaCommentsService>()
    comments.note.mockResolvedValue(undefined)
    const taker = mock<MetaEventTaker>()
    taker.take.mockResolvedValue(false)
    const inbox = fakeInbox()
    if (!claimed) inbox.seen("meta", DELIVERY_ID)
    const moduleRef = await Test.createTestingModule({
        providers: [
            MetaInboxService,
            { provide: MetaReceiptPolicy, useValue: meta },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: INBOX, useValue: inbox },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: ConnectionsService, useValue: connections },
            { provide: ConversationsService, useValue: conversations },
            { provide: MetaThreadsService, useValue: threads },
            { provide: MetaCommentsService, useValue: comments },
            { provide: META_EVENT_TAKER, useValue: taker },
        ],
    }).compile()
    return {
        inbox,
        service: moduleRef.get(MetaInboxService),
        tx,
        meta,
        connections,
        outbox,
        write,
        conversations,
        threads,
        comments,
        taker,
    }
}

describe("MetaInboxService receipt intake", () => {
    it("records a receipt and publishes only its reference before any business effect", async () => {
        const { service, tx, meta, connections, write, inbox } = await build([event()])

        await service.accept(RAW_BODY, SIGNATURE)

        const manager = write.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(inbox.receipts.map(({ source, eventId, entity, row }) => ({ source, eventId, entity, row }))).toEqual([
            RECEIPT_CLAIM,
        ])
        expect(write).toHaveBeenCalledWith(
            manager,
            META_DELIVERY_QUEUE,
            { deliveryId: DELIVERY_ID },
            { dedupeKey: `meta-delivery:${DELIVERY_ID}` },
        )
        expect(meta.parse).not.toHaveBeenCalled()
        expect(connections.recordEvent).not.toHaveBeenCalled()
        expect(tx.commits).toBe(1)
    })

    it.each(unreadableReceipts)(
        "refuses an unreadable receipt, which has no delivery id to claim: $rawBody / $signature",
        async ({ rawBody, signature }) => {
            const { service, outbox, meta, tx } = await build()
            await expect(service.accept(rawBody, signature)).rejects.toThrow("DATABASE_WEBHOOK_DELIVERY_ID_REQUIRED")
            expect(outbox.jobs).toEqual([])
            expect(meta.verifyDelivery).not.toHaveBeenCalled()
            expect(meta.parse).not.toHaveBeenCalled()
            expect(tx.em.query).not.toHaveBeenCalled()
            expect(tx.outcomes).toEqual(["rollback"])
        },
    )

    it("acknowledges a duplicate without another outbox message", async () => {
        const { service, outbox, connections, meta, tx, inbox } = await build([event()], false)
        await expect(service.accept(RAW_BODY, SIGNATURE)).resolves.toBeUndefined()
        expect(outbox.jobs).toEqual([])
        expect(meta.parse).not.toHaveBeenCalled()
        expect(connections.findLiveByMeta).not.toHaveBeenCalled()
        expect(connections.recordEvent).not.toHaveBeenCalled()
        expect(tx.commits).toBe(1)
        expect(inbox.claims).toEqual([{ source: "meta", eventId: DELIVERY_ID }])
        expect(inbox.receipts).toEqual([])
    })

    it("rolls back a receipt when publication fails", async () => {
        const { service, tx, outbox } = await build()
        const failure = new Error("queue unavailable")
        outbox.failNext("write", failure)
        await expect(service.accept(RAW_BODY, SIGNATURE)).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)
    })
})

describe("MetaInboxService empty receipts", () => {
    it("defers parsing a signed body without events and completes it without downstream effects", async () => {
        const { service, tx, meta, connections, outbox, inbox } = await build()

        await expect(service.accept(RAW_BODY, SIGNATURE)).resolves.toBeUndefined()
        expect(meta.parse).not.toHaveBeenCalled()

        await expect(service.processRecordedDelivery({ deliveryId: DELIVERY_ID })).resolves.toBeUndefined()
        expect(meta.parse).toHaveBeenCalledWith(BODY)
        expect(inbox.receipts.map(({ source, eventId, entity, row }) => ({ source, eventId, entity, row }))).toEqual([
            RECEIPT_CLAIM,
        ])
        expectConsumed(tx)
        expect(connections.findLiveByMeta).not.toHaveBeenCalled()
        expect(connections.recordEvent).not.toHaveBeenCalled()
        expect(outbox.jobsOf(META_INBOUND_QUEUE)).toEqual([])
        expect(tx.commits).toBe(2)
    })
})

describe("MetaInboxService", () => {
    it("opens Facebook and Instagram message windows and queues each event in the claiming transaction", async () => {
        const { service, tx, connections, write, threads } = await build([dm, postback])

        await expect(service.processRecordedDelivery({ deliveryId: DELIVERY_ID })).resolves.toBeUndefined()

        const manager = connections.findLiveByMeta.mock.calls[0]?.[3]
        expect(manager).toBeDefined()
        expect(manager).not.toBe(tx.em)
        expect(tx.commits).toBe(1)
        expect(connections.findLiveByMeta.mock.calls).toEqual(expectedSurfaceLookups(manager))
        expectConsumed(tx)
        expect(threads.touch.mock.calls).toEqual(expectedThreadWindows(manager))
        expect(connections.recordEvent.mock.calls).toEqual(expectedMessageRecords(manager))
        expect(write.mock.calls).toEqual(expectedMessageJobs(manager, META_INBOUND_QUEUE))
    })
})

describe("MetaInboxService", () => {
    it("records comment and mention windows when the event carries a comment id", async () => {
        const { service, tx, connections, write, comments } = await build([comment, mention])

        await service.processRecordedDelivery({ deliveryId: DELIVERY_ID })

        const manager = connections.findLiveByMeta.mock.calls[0]?.[3]
        expect(manager).toBeDefined()
        expect(manager).not.toBe(tx.em)
        expectConsumed(tx)
        expect(comments.note.mock.calls).toEqual(expectedCommentWindows(manager))
        expect(connections.recordEvent.mock.calls).toEqual(expectedCommentRecords(manager))
        expect(write.mock.calls).toEqual(expectedCommentJobs(manager, META_INBOUND_QUEUE))
    })
})

describe("MetaInboxService", () => {
    it("queues owned events without window ids and lead events without opening either window", async () => {
        const events = missingWindowEvents
        const { service, tx, connections, write } = await build(events)

        await service.processRecordedDelivery({ deliveryId: DELIVERY_ID })

        const manager = connections.findLiveByMeta.mock.calls[0]?.[3]
        expect(manager).toBeDefined()
        expect(manager).not.toBe(tx.em)
        expectConsumed(tx)
        expect(connections.recordEvent.mock.calls).toEqual(
            events.map(() => ["connection-1", { amount: 0, content: "Lan", at: AT, text: "Hello" }, manager]),
        )
        expect(write.mock.calls).toEqual(surfaceEventCalls(events, manager, META_INBOUND_QUEUE))
    })

    it("drops events with no surface identity or whose surface has no live connection", async () => {
        const events = unownedSurfaceEvents
        const { service, tx, connections, outbox } = await build(events)
        connections.findLiveByMeta.mockResolvedValue(null)

        await service.processRecordedDelivery({ deliveryId: DELIVERY_ID })

        const manager = connections.findLiveByMeta.mock.calls[0]?.[3]
        expect(manager).toBeDefined()
        expect(manager).not.toBe(tx.em)
        expect(connections.findLiveByMeta.mock.calls).toEqual(expectedUnownedLookups(manager))
        expectConsumed(tx)
        expect(connections.recordEvent).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
        expect(tx.commits).toBe(1)
    })

    it("rolls back the claimed delivery when a queued write fails", async () => {
        const { service, tx, outbox } = await build([event()])
        const failure = new Error("queue unavailable")
        outbox.failNext("write", failure)

        await expect(service.processRecordedDelivery({ deliveryId: DELIVERY_ID })).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)
        expectLockedOnly(tx)
    })
})

describe("MetaInboxService deliver", () => {
    it.each(directMessages)("delivers $name in one transaction", async ({ inbound, personId, visitor }) => {
        const { service, tx, conversations, connections, outbox } = await build()
        const job: MetaInboundJob = { connectionId: "connection-1", workspaceId: "workspace-1", event: inbound }

        await expect(service.deliver(job)).resolves.toBeUndefined()

        const manager = conversations.acceptMeta.mock.calls[0]?.[2]
        expect(isTransactionManager(manager)).toBe(true)
        expect(manager).not.toBe(tx.em)
        expect(conversations.acceptMeta.mock.calls).toEqual(directMessageCalls(manager, inbound, personId, visitor))
        expect(tx.commits).toBe(1)
        expect(tx.rollbacks).toBe(0)
        expect(tx.em.transaction).toHaveBeenCalledTimes(1)
        expect(tx.em.query).not.toHaveBeenCalled()
        expect(connections.findLiveByMeta).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
    })

    it.each(ignoredMessages)("leaves $name alone", async ({ inbound }) => {
        const { service, tx, conversations } = await build()

        await expect(
            service.deliver({ connectionId: "connection-1", workspaceId: "workspace-1", event: inbound }),
        ).resolves.toBeUndefined()

        expect(conversations.acceptMeta).not.toHaveBeenCalled()
        expect(tx.em.transaction).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual([])
    })
})

describe("MetaInboxService consumer transaction", () => {
    it("retries a real parsed receipt after rollback and ignores a completed replay", async () => {
        const payload = replayReceiptBody
        const { service, tx, connections, outbox } = await build([], true, pendingReceipt(payload), true)
        const failure = new Error("connection failed")
        connections.recordEvent.mockRejectedValueOnce(failure)
        await expect(service.processRecordedDelivery({ deliveryId: DELIVERY_ID })).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
        expect(tx.em.update).not.toHaveBeenCalled()
        await service.processRecordedDelivery({ deliveryId: DELIVERY_ID })
        expect(outbox.jobsOf(META_INBOUND_QUEUE)).toEqual([
            objectLike({
                payload: objectLike({
                    event: objectLike({ text: "Hello", timestamp: Date.parse(AT) }),
                }),
            }),
        ])
        expect(evaluatedCalls(tx.em.update.mock.calls, 2)).toEqual([COMPLETE_CALL])
        const committed = outbox.jobs.length
        tx.em.findOne.mockResolvedValueOnce(null)
        await service.processRecordedDelivery({ deliveryId: DELIVERY_ID })
        expect(outbox.jobs).toHaveLength(committed)
        expect(connections.recordEvent).toHaveBeenCalledTimes(2)
    })

    it("uses the receipt manager for connection status and completes only after it succeeds", async () => {
        const { service, tx, connections } = await build([event()])
        connections.recordEvent.mockImplementation((_id, _event, manager) => {
            expect(isTransactionManager(manager)).toBe(true)
            expectLockedOnly(tx)
            return Promise.resolve(null)
        })

        await service.processRecordedDelivery({ deliveryId: DELIVERY_ID })

        expect(connections.recordEvent.mock.calls[0]?.[2]).toBe(connections.findLiveByMeta.mock.calls[0]?.[3])
        expectConsumed(tx)
    })

    it("rolls back the consumer and leaves completion unwritten when connection status fails", async () => {
        const { service, tx, connections, outbox } = await build([event()])
        const failure = new Error("connection event failed")
        connections.recordEvent.mockRejectedValue(failure)

        await expect(service.processRecordedDelivery({ deliveryId: DELIVERY_ID })).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)
        expectLockedOnly(tx)
        expect(outbox.jobs).toEqual([])
    })
})

describe("MetaInboxService deliver", () => {
    it("normalizes omitted runtime text before handing the DM to conversations", async () => {
        const { service, tx, conversations } = await build()
        const incompleteEvent = event()
        Reflect.deleteProperty(incompleteEvent, "text")

        await service.deliver({
            connectionId: "connection-1",
            workspaceId: "workspace-1",
            event: incompleteEvent,
        })

        const manager = conversations.acceptMeta.mock.calls[0]?.[2]
        expect(isTransactionManager(manager)).toBe(true)
        expect(manager).not.toBe(tx.em)
        expect(conversations.acceptMeta.mock.calls).toEqual([
            [
                "connection-1",
                { platform: "facebook", personId: "person-1", visitor: "Lan", text: "", eventId: "dm:message-1" },
                manager,
            ],
        ])
        expect(tx.commits).toBe(1)
    })

    it("delivers the event a claimed job payload carries", async () => {
        const { service, conversations } = await build()

        await service.deliverPayload({ connectionId: "connection-1", workspaceId: "workspace-1", event: event() })

        expect(conversations.acceptMeta.mock.calls[0]?.slice(0, 2)).toEqual([
            "connection-1",
            { platform: "facebook", personId: "person-1", visitor: "Lan", text: "Hello", eventId: "dm:message-1" },
        ])
    })

    it("leaves an event the taker took to the taker", async () => {
        const { service, conversations, taker } = await build()
        taker.take.mockResolvedValue(true)
        const job = { connectionId: "connection-1", workspaceId: "workspace-1", event: event() }

        await service.deliverPayload(job)

        expect(taker.take).toHaveBeenCalledWith(job)
        expect(conversations.acceptMeta).not.toHaveBeenCalled()
    })

    it("leaves a claimed job payload that is not a queued Meta event alone", async () => {
        const { service, tx, conversations } = await build()

        await expect(service.deliverPayload({ connectionId: "connection-1" })).resolves.toBeUndefined()

        expect(conversations.acceptMeta).not.toHaveBeenCalled()
        expect(tx.em.transaction).not.toHaveBeenCalled()
    })

    it("rolls back and propagates a failure from the conversation", async () => {
        const { service, tx, conversations } = await build()
        const failure = new Error("conversation failed")
        conversations.acceptMeta.mockRejectedValue(failure)

        await expect(
            service.deliver({ connectionId: "connection-1", workspaceId: "workspace-1", event: event() }),
        ).rejects.toBe(failure)

        expect(conversations.acceptMeta).toHaveBeenCalledTimes(1)
        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)
    })
})

describe("MetaInboxService deferred delivery", () => {
    it("leaves an already processed receipt alone", async () => {
        const { service, tx, meta, outbox } = await build([], true, null)
        await expect(service.processRecordedDelivery({ deliveryId: DELIVERY_ID })).resolves.toBeUndefined()
        expectLockedOnly(tx)
        expect(meta.parse).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
        expect(tx.commits).toBe(1)
    })

    it("marks a receipt with no parsed events complete", async () => {
        const { service, tx, meta, outbox } = await build()
        await expect(service.processRecordedDelivery({ deliveryId: DELIVERY_ID })).resolves.toBeUndefined()
        expect(meta.parse.mock.calls).toEqual([[BODY]])
        expectConsumed(tx)
        expect(outbox.jobs).toEqual([])
        expect(tx.commits).toBe(1)
    })

    it("propagates a failed receipt claim and rolls back its transaction", async () => {
        const { service, tx, inbox, outbox } = await build()
        const failure = new Error("inbox unavailable")
        inbox.failNext("claimRow", failure)
        await expect(service.accept(RAW_BODY, SIGNATURE)).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)
        expect(outbox.jobs).toEqual([])
    })
})
