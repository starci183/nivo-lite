import {
    AT,
    OWNER,
    RAW_BODY,
    SIGNATURE,
    comment,
    directMessages,
    dm,
    event,
    ignoredMessages,
    mention,
    postback,
    unreadableReceipts,
} from "@tests/fixtures/builders/meta-inbox.builder"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { Test } from "@nestjs/testing"
import { AccountDataIntakeService, AccountDataReadService, type AccountWrite, type PendingRow } from "@modules/domain/account-data"
import { ConnectionsService } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { ProviderTriggersService, type DeliverResult } from "@modules/domain/provider-triggers"
import { MESSAGE_CATALOG, type MessageCatalog } from "@modules/platform/i18n"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { FACEBOOK_MESSAGE_WEBHOOK, INSTAGRAM_MESSAGE_WEBHOOK } from "./meta-message.trigger"
import { MetaCommentsService } from "@modules/domain/meta-comments"
import { MetaThreadsService } from "@modules/domain/meta-threads"
import { MetaReceiptPolicy } from "./meta-receipt.policy"
import type { MetaClient, MetaEvent } from "@modules/integrations/meta"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { MetaInboxErrorCode } from "./errors/meta-inbox.error"
import { META_INBOUND_QUEUE, META_DELIVERY_QUEUE } from "./meta-inbox.contracts"
import type { MetaInboundJob } from "./meta-inbox.contracts"
import { MetaInboxService } from "./meta-inbox.service"
import { MetaInboxLogEvent } from "./meta-inbox.log-events"

/** The connection a queued delivery id names (a uuid), and the account its pending rows belong to. */
const CONNECTION = "0b9a3c1e-5d7f-4a2b-9c8d-1e2f3a4b5c6d"
const ACCOUNT = { provider: "meta", connectionId: OWNER.id, workspaceId: OWNER.workspaceId }

/** The queued delivery id of an event. */
const deliveryIdOf = (inbound: MetaEvent): string => `${CONNECTION}:${inbound.event_key}`

/** The pending `meta.event` row that holds one stored value as its event. */
const pendingOf = (stored: unknown = event(), key = "dm:message-1"): PendingRow => ({
    id: "row-1",
    type: "meta.event",
    key,
    owner: ACCOUNT,
    value: { eventKey: key, raw: stored },
})

/** What the intake answers for one event row. */
const writtenOf = (key: string, isNew = true): AccountWrite => ({
    owner: ACCOUNT,
    rows: [{ type: "meta.event", key, id: isNew ? "row-1" : "", isNew }],
})

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What the ONE delivery answers: the event delivered, and taken by a registered graph unless `untaken`. */
const deliveredOf = (untaken = 0): DeliverResult => ({ status: "delivered", events: 1, dropped: 0, woken: [], repeats: 0, untaken, held: 0 })

const build = async (events: ReadonlyArray<MetaEvent> = [], pending: PendingRow | null = pendingOf()) => {
    const tx = fakeTransaction(mockEntityManager({}))
    const connections = mock<ConnectionsService>()
    connections.findLiveByMeta.mockResolvedValue(OWNER)
    const meta = mock<MetaClient>()
    meta.parse.mockReturnValue([...events])
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    connections.intakeOf.mockResolvedValue({ kind: "ok", value: { workspaceId: "workspace-1" } } as Awaited<ReturnType<ConnectionsService["intakeOf"]>>)
    const triggers = mock<ProviderTriggersService>()
    triggers.deliver.mockResolvedValue(deliveredOf())
    const reads = mock<AccountDataReadService>()
    reads.get.mockResolvedValue({ id: "row-9", type: "meta.event", typeVersion: 1, key: "dm:message-1", value: {}, occurredAt: new Date("2026-11-12T00:00:00.000Z"), processedAt: null })
    const inboundEvents = mock<InboundEventsService>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key: string) => key)
    const threads = mock<MetaThreadsService>()
    threads.touch.mockResolvedValue(undefined)
    const comments = mock<MetaCommentsService>()
    comments.note.mockResolvedValue(undefined)
    const intake = mock<AccountDataIntakeService>()
    intake.write.mockResolvedValue(writtenOf("dm:message-1"))
    intake.lockPending.mockResolvedValue(pending)
    intake.complete.mockResolvedValue(undefined)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            MetaInboxService,
            { provide: MetaReceiptPolicy, useValue: meta },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: AccountDataIntakeService, useValue: intake },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: ConnectionsService, useValue: connections },
            { provide: ProviderTriggersService, useValue: triggers },
            { provide: AccountDataReadService, useValue: reads },
            { provide: InboundEventsService, useValue: inboundEvents },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: MetaThreadsService, useValue: threads },
            { provide: MetaCommentsService, useValue: comments },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return {
        intake,
        service: moduleRef.get(MetaInboxService),
        tx,
        meta,
        connections,
        outbox,
        write,
        triggers,
        reads,
        inboundEvents,
        threads,
        comments,
        logger,
    }
}

describe("MetaInboxService receipt", () => {
    it("writes each event of a live surface once as a meta.event row of its account and queues its reference", async () => {
        const second = event({ mid: "message-2", event_key: "dm:message-2" })
        const unowned = event({ page_id: "page-2", event_key: "dm:message-3" })
        const events = [event(), unowned, second, event({ page_id: null })]
        const { service, connections, write, intake } = await build(events)
        connections.findLiveByMeta.mockImplementation((_p, _k, id) => Promise.resolve(id === "page-1" ? OWNER : null))
        intake.write.mockResolvedValueOnce(writtenOf("dm:message-1")).mockResolvedValueOnce(writtenOf("dm:message-2"))
        await service.accept(RAW_BODY, SIGNATURE)
        const manager = write.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(connections.findLiveByMeta.mock.calls.map((call) => call[2])).toEqual(["page-1", "page-2"])
        expect(intake.write.mock.calls).toEqual([
            [manager, OWNER.id, [{ type: "meta.event", value: { eventKey: "dm:message-1", raw: event() } }]],
            [manager, OWNER.id, [{ type: "meta.event", value: { eventKey: "dm:message-2", raw: second } }]],
        ])
        expect(write.mock.calls.map((call) => call.slice(1))).toEqual(
            ["dm:message-1", "dm:message-2"].map((key) => [
                META_DELIVERY_QUEUE,
                { deliveryId: `${OWNER.id}:${key}` },
                { dedupeKey: `meta-delivery:${OWNER.id}:${key}` },
            ]),
        )
        expect(connections.recordEvent).not.toHaveBeenCalled()
    })

    it.each(unreadableReceipts)("refuses an unreadable receipt: $rawBody", async ({ rawBody, signature }) => {
        const { service, outbox, intake, tx } = await build([event()])
        const refusal = objectLike({ code: MetaInboxErrorCode.DeliveryInvalid })
        await expect(service.accept(rawBody, signature)).rejects.toEqual(refusal)
        expect([intake.write.mock.calls, outbox.jobs, tx.outcomes]).toEqual([[], [], ["rollback"]])
    })

    it("queues nothing for a redelivery or a connection nobody holds any more", async () => {
        const { service, intake, outbox, tx } = await build([event()])
        intake.write.mockResolvedValueOnce(writtenOf("dm:message-1", false)).mockResolvedValueOnce({ owner: null, rows: [] })
        await service.accept(RAW_BODY, SIGNATURE)
        await service.accept(RAW_BODY, SIGNATURE)
        expect([outbox.jobs, tx.commits]).toEqual([[], 2])
    })
})

describe("MetaInboxService sandbox receipt", () => {
    const SANDBOX_OWNER = { id: "11111111-1111-4111-8111-111111111111", workspaceId: "ws-sandbox" }

    it("writes every event of the body as a meta.event row of the named sandbox account, looks up no Page id and queues its reference", async () => {
        const second = event({ mid: "message-2", event_key: "dm:message-2" })
        const other = event({ page_id: "sandbox-page", event_key: "dm:message-3" })
        const { service, connections, write, intake } = await build([event(), second, other])
        intake.write.mockResolvedValue(writtenOf("dm:message-1"))
        await service.acceptSandbox(RAW_BODY, SANDBOX_OWNER)
        const manager = write.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(connections.findLiveByMeta).not.toHaveBeenCalled()
        expect(intake.write.mock.calls.map((call) => [call[1], (call[2] as ReadonlyArray<{ value: { eventKey: string } }>)[0]?.value.eventKey])).toEqual([
            [SANDBOX_OWNER.id, "dm:message-1"],
            [SANDBOX_OWNER.id, "dm:message-2"],
            [SANDBOX_OWNER.id, "dm:message-3"],
        ])
        expect(write).toHaveBeenCalledTimes(3)
    })

    it.each(unreadableReceipts.filter((one) => one.signature !== undefined))("refuses an unreadable body: $rawBody", async ({ rawBody }) => {
        const { service, outbox, intake, tx } = await build([event()])
        await expect(service.acceptSandbox(rawBody, SANDBOX_OWNER)).rejects.toEqual(objectLike({ code: MetaInboxErrorCode.DeliveryInvalid }))
        expect([intake.write.mock.calls, outbox.jobs, tx.outcomes]).toEqual([[], [], ["rollback"]])
    })
})

describe("MetaInboxService consumer", () => {
    it("processes the one event for the row's own connection, keeps the message and the person and completes it", async () => {
        const pending = pendingOf(structuredClone(event()))
        const { service, tx, connections, write, intake } = await build([], pending)
        await service.processRecordedDelivery({ deliveryId: deliveryIdOf(event()) })
        const manager = intake.lockPending.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(intake.lockPending.mock.calls).toEqual([[manager, "meta.event", CONNECTION, "dm:message-1"]])
        expect(connections.findLiveByMeta).not.toHaveBeenCalled()
        expect(connections.recordEvent.mock.calls).toEqual([
            [OWNER.id, { amount: 0, content: "Lan", at: AT, text: "Hello" }, manager],
        ])
        const job: MetaInboundJob = { connectionId: OWNER.id, workspaceId: OWNER.workspaceId, event: event() }
        expect(write.mock.calls).toEqual([
            [manager, META_INBOUND_QUEUE, job, { dedupeKey: `meta_inbound:${OWNER.id}:dm:message-1` }],
        ])
        expect(intake.write.mock.calls).toEqual([
            [
                manager,
                OWNER.id,
                [
                    {
                        type: "meta.message",
                        value: {
                            eventKey: "dm:message-1",
                            mid: "message-1",
                            platform: "facebook",
                            userId: "person-1",
                            direction: "in",
                            text: "Hello",
                            at: AT,
                        },
                    },
                    { type: "meta.user", value: { userId: "person-1", platform: "facebook", name: "Lan" } },
                ],
            ],
        ])
        expect(intake.complete.mock.calls).toEqual([[manager, pending]])
        expect(tx.commits).toBe(1)
    })

})

describe("MetaInboxService consumer windows", () => {
    it("opens the messaging window of a message and a postback, the comment window of a comment and a mention", async () => {
        const run = async (inbound: MetaEvent) => {
            const built = await build([], pendingOf(inbound, inbound.event_key))
            await built.service.processRecordedDelivery({ deliveryId: deliveryIdOf(inbound) })
            return built
        }
        const message = await run(dm)
        expect(message.threads.touch.mock.calls[0]?.[0]).toEqual({ connectionId: OWNER.id, platform: "facebook", userId: "person-1", at: AT })
        expect(message.connections.recordEvent.mock.calls[0]?.[1]).toEqual({ amount: 0, content: "Lan", at: AT, text: "x".repeat(160) })
        const button = await run(postback)
        expect(button.threads.touch.mock.calls[0]?.[0]).toEqual({
            connectionId: OWNER.id,
            platform: "instagram",
            userId: "ig-person-1",
            at: AT,
        })
        expect(button.intake.write.mock.calls[0]?.[2]).toEqual([
            { type: "meta.user", value: { userId: "ig-person-1", platform: "instagram" } },
        ])
        const commented = await run(comment)
        expect(commented.comments.note.mock.calls[0]?.[0]).toEqual({ connectionId: OWNER.id, commentId: "comment-1", platform: "facebook", at: AT })
        expect(commented.intake.write.mock.calls[0]?.[2]).toEqual([])
        const mentioned = await run(mention)
        expect(mentioned.comments.note.mock.calls[0]?.[0]).toEqual({
            connectionId: OWNER.id,
            commentId: "comment-2",
            platform: "instagram",
            at: AT,
        })
    })

})

describe("MetaInboxService consumer edges", () => {
    it("completes a stored row that is no event without any effect", async () => {
        const { service, intake, outbox, connections } = await build([], pendingOf({ kind: "dm" }))
        await service.processRecordedDelivery({ deliveryId: deliveryIdOf(event()) })
        expect([intake.write.mock.calls, outbox.jobs, connections.recordEvent.mock.calls, intake.complete.mock.calls.length]).toEqual([
            [],
            [],
            [],
            1,
        ])
    })

    it("does nothing for an event that is absent or completed, or a delivery id that names no connection", async () => {
        const { service, intake, outbox, connections } = await build([], null)
        await service.processRecordedDelivery({ deliveryId: deliveryIdOf(event()) })
        await service.processRecordedDelivery({ deliveryId: "cf4757fb1d998bf973749a593b19bf7e" })
        expect(intake.lockPending).toHaveBeenCalledTimes(1)
        expect([outbox.jobs, connections.recordEvent.mock.calls, intake.complete.mock.calls]).toEqual([[], [], []])
    })

    it("leaves the row pending and rethrows when an effect fails", async () => {
        const { service, tx, intake, connections, outbox } = await build()
        const failure = new Error("connection event failed")
        connections.recordEvent.mockRejectedValue(failure)
        await expect(service.processRecordedDelivery({ deliveryId: deliveryIdOf(event()) })).rejects.toBe(failure)
        expect([intake.complete.mock.calls, tx.rollbacks, tx.commits, outbox.jobs]).toEqual([[], 1, 0, []])
    })

    it("leaves the row pending when keeping the message fails", async () => {
        const { service, tx, intake } = await build()
        intake.write.mockRejectedValue(new Error("keep failed"))
        await expect(service.processRecordedDelivery({ deliveryId: deliveryIdOf(event()) })).rejects.toThrow("keep failed")
        expect([intake.complete.mock.calls, tx.rollbacks]).toEqual([[], 1])
    })
})

describe("MetaInboxService deliver", () => {
    it.each(directMessages)("hands $name to the ONE delivery as its platform's trigger translates it, in one transaction", async ({ inbound, personId }) => {
        const { service, tx, triggers, connections, outbox, reads } = await build()
        const job: MetaInboundJob = { connectionId: "connection-1", workspaceId: "workspace-1", event: inbound }

        // Ledger (ROAD Opus-1f, 2026-11-14): `deliver` answers a typed outcome (an unhandled case is never silent); was `undefined`.
        await expect(service.deliver(job)).resolves.toBe("delivered")

        const manager = triggers.deliver.mock.calls[0]?.[1]
        expect(isTransactionManager(manager)).toBe(true)
        expect(reads.get).toHaveBeenCalledWith("connection-1", "meta.event", inbound.event_key, manager)
        expect(triggers.deliver).toHaveBeenCalledWith(
            {
                workspaceId: "workspace-1",
                declaration: inbound.platform === "instagram" ? INSTAGRAM_MESSAGE_WEBHOOK : FACEBOOK_MESSAGE_WEBHOOK,
                connectionId: "connection-1",
                agentId: null,
                events: [
                    {
                        event: {
                            id: inbound.event_key,
                            subject: { channel: inbound.platform, id: personId, ...(inbound.sender_name === null ? {} : { name: inbound.sender_name }) },
                            data: { messageKey: `meta:${inbound.event_key}`, text: inbound.text, at: new Date(inbound.timestamp).toISOString() },
                        },
                        raw: { type: "meta.event", id: "row-9" },
                        occurredAt: new Date(inbound.timestamp).toISOString(),
                    },
                ],
            },
            manager,
        )
        expect(tx.commits).toBe(1)
        expect(connections.findLiveByMeta).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
    })

    it.each(ignoredMessages)("leaves $name alone", async ({ inbound }) => {
        const { service, tx, triggers } = await build()

        await expect(
            service.deliver({ connectionId: "connection-1", workspaceId: "workspace-1", event: inbound }),
        ).resolves.toBe("not_a_message")

        expect(triggers.deliver).not.toHaveBeenCalled()
        expect(tx.em.transaction).not.toHaveBeenCalled()
    })

    it("delivers the event a claimed job payload carries, and leaves any other payload alone", async () => {
        const { service, triggers } = await build()

        await service.deliverPayload({ connectionId: "connection-1", workspaceId: "workspace-1", event: event() })
        await service.deliverPayload({ connectionId: "connection-1" })

        expect(triggers.deliver).toHaveBeenCalledTimes(1)
        expect(triggers.deliver.mock.calls[0]?.[0].events[0]?.event).toMatchObject({
            id: "dm:message-1",
            subject: { channel: "facebook", id: "person-1", name: "Lan" },
            data: { messageKey: "meta:dm:message-1", text: "Hello" },
        })
    })

    it("delivers the same event id for a replay of the same job", async () => {
        const { service, triggers } = await build()
        const job: MetaInboundJob = { connectionId: "connection-1", workspaceId: "workspace-1", event: event() }

        await service.deliver(job)
        await service.deliver(job)

        expect(triggers.deliver.mock.calls.map((call) => call[0].events[0]?.event.id)).toEqual(["dm:message-1", "dm:message-1"])
    })

    it("keeps a message no registered graph took for the owner, named by Meta or by the platform's guest label", async () => {
        const { service, triggers, inboundEvents } = await build()
        triggers.deliver.mockResolvedValue(deliveredOf(1))

        await service.deliver({ connectionId: "connection-1", workspaceId: "workspace-1", event: event({ sender_name: null }) })

        expect(inboundEvents.keepUnrouted).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "workspace-1",
            channel: "facebook",
            sender: "conversations.facebookGuest",
            body: "Hello",
            eventId: "meta:dm:message-1:connection-1",
        })
    })

    it("delivers nothing for a connection that is no live Meta one, and says so: typed `account_removed` and one log line", async () => {
        const { service, triggers, connections, logger } = await build()
        connections.intakeOf.mockResolvedValue({ kind: "refused", code: "x" } as unknown as Awaited<ReturnType<ConnectionsService["intakeOf"]>>)

        await expect(service.deliver({ connectionId: "connection-1", workspaceId: "workspace-1", event: event() })).resolves.toBe(
            "account_removed",
        )

        expect(triggers.deliver).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(MetaInboxLogEvent.AccountRemoved, {
            connectionId: "connection-1",
            eventKey: "dm:message-1",
            refusal: "refused",
        })
    })

    it("answers `account_removed` (logged) when the delivery's own gate finds the account disconnected, `switched_off` when off", async () => {
        const { service, triggers, logger, inboundEvents } = await build()
        const job = { connectionId: "connection-1", workspaceId: "workspace-1", event: event() }
        triggers.deliver.mockResolvedValueOnce({ status: "disconnected" }).mockResolvedValueOnce({ status: "off" })

        await expect(service.deliver(job)).resolves.toBe("account_removed")
        await expect(service.deliver(job)).resolves.toBe("switched_off")

        expect(logger.warn).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith(MetaInboxLogEvent.AccountRemoved, expect.objectContaining({ refusal: "disconnected" }))
        expect(inboundEvents.keepUnrouted).not.toHaveBeenCalled()
    })

    it("rolls back and propagates a failure of the delivery", async () => {
        const { service, tx, triggers } = await build()
        const failure = new Error("delivery failed")
        triggers.deliver.mockRejectedValue(failure)

        await expect(
            service.deliver({ connectionId: "connection-1", workspaceId: "workspace-1", event: event() }),
        ).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
    })
})
