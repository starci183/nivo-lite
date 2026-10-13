import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { RecordingQueueOutbox } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import { ConversationsService } from "@modules/domain/conversations"
import { META_CLIENT } from "@modules/integrations/meta"
import type { MetaClient, MetaEvent } from "@modules/integrations/meta"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { MetaInboxError, MetaInboxErrorCode } from "./errors/meta-inbox.error"
import { META_INBOUND_QUEUE } from "./meta-inbox.contracts"
import type { MetaInboundJob } from "./meta-inbox.contracts"
import { MetaInboxService } from "./meta-inbox.service"
import {
    COMPLETE_META_INBOX,
    INSERT_META_INBOX,
    NOTE_META_COMMENT,
    TOUCH_META_THREAD,
} from "./persistence/meta-inbox.sql"

const BODY = { object: "page", entry: [{ id: "page-1" }] }
const RAW_BODY = Buffer.from(JSON.stringify(BODY))
const DELIVERY_ID = "cf4757fb1d998bf973749a593b19bf7ecac5a415369525483e3dd6219ed26a52"
const SIGNATURE = "sha256=signed-delivery"
const AT = "2026-10-12T03:00:00.000Z"
const OWNER = { id: "connection-1", workspaceId: "workspace-1" }

/** A parsed event whose text field was omitted at runtime, which the type marks as present. */
const isDmEvent = (value: object): value is MetaEvent => "kind" in value && value.kind === "dm"

/** Drops `text` so deliver normalises an omitted field to an empty string. */
const omitText = (value: MetaEvent): MetaEvent => {
    const fields: Record<string, unknown> = { ...value }
    delete fields.text
    return isDmEvent(fields) ? fields : value
}

const event = (overrides: Partial<MetaEvent> = {}): MetaEvent => ({
    kind: "dm",
    platform: "facebook",
    page_id: "page-1",
    ig_id: null,
    sender_psid: "person-1",
    sender_igsid: null,
    sender_name: "Lan",
    text: "Hello",
    comment_id: null,
    post_id: null,
    leadgen_id: null,
    form_id: null,
    ad_id: null,
    referral: null,
    postback_payload: null,
    mid: "message-1",
    timestamp: Date.parse(AT),
    event_key: "dm:message-1",
    ...overrides,
})

const build = async (events: ReadonlyArray<MetaEvent> = [], claimed = [{ id: "inbox-1" }]) => {
    const tx = fakeTransaction(
        mockEntityManager({
            query: [
                [INSERT_META_INBOX, claimed],
                [COMPLETE_META_INBOX, []],
                [TOUCH_META_THREAD, []],
                [NOTE_META_COMMENT, []],
            ],
        }),
    )
    const connections = mock<ConnectionsService>()
    connections.findLiveByMeta.mockResolvedValue(OWNER)
    const meta = mock<MetaClient>()
    meta.verifyDelivery.mockReturnValue(true)
    meta.parse.mockReturnValue([...events])
    const outbox: RecordingQueueOutbox = recordingQueueOutbox()
    const conversations = mock<ConversationsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            MetaInboxService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: META_CLIENT, useValue: meta },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: ConnectionsService, useValue: connections },
            { provide: ConversationsService, useValue: conversations },
        ],
    }).compile()
    return { service: moduleRef.get(MetaInboxService), tx, meta, connections, outbox, conversations }
}

describe("MetaInboxService", () => {
    it("refuses a missing raw body before checking the signature", async () => {
        const { service, tx, meta } = await build()

        await expect(service.accept(undefined, SIGNATURE)).rejects.toEqual(
            new MetaInboxError({ code: MetaInboxErrorCode.SignatureInvalid }),
        )

        expect(meta.verifyDelivery).not.toHaveBeenCalled()
        expect(meta.parse).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual([])
    })

    it("refuses a delivery whose signature is absent or invalid", async () => {
        const { service, tx, meta } = await build()
        meta.verifyDelivery.mockReturnValue(false)

        await expect(service.accept(RAW_BODY, undefined)).rejects.toEqual(
            new MetaInboxError({ code: MetaInboxErrorCode.SignatureInvalid }),
        )
        await expect(service.accept(RAW_BODY, "bad-signature")).rejects.toEqual(
            new MetaInboxError({ code: MetaInboxErrorCode.SignatureInvalid }),
        )

        expect(meta.verifyDelivery.mock.calls).toEqual([
            [undefined, RAW_BODY],
            ["bad-signature", RAW_BODY],
        ])
        expect(meta.parse).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual([])
    })

    it("acknowledges a signed body without events without claiming a delivery", async () => {
        const { service, tx, meta } = await build()

        await expect(service.accept(RAW_BODY, SIGNATURE)).resolves.toBeUndefined()

        expect(meta.verifyDelivery).toHaveBeenCalledWith(SIGNATURE, RAW_BODY)
        expect(meta.parse).toHaveBeenCalledWith(BODY)
        expect(tx.outcomes).toEqual([])
        expect(tx.em.query).not.toHaveBeenCalled()
    })

    it("passes null to the parser for invalid JSON and acknowledges an empty parse", async () => {
        const { service, tx, meta } = await build()
        const malformed = Buffer.from("{invalid-json")

        await expect(service.accept(malformed, SIGNATURE)).resolves.toBeUndefined()

        expect(meta.verifyDelivery).toHaveBeenCalledWith(SIGNATURE, malformed)
        expect(meta.parse).toHaveBeenCalledWith(null)
        expect(tx.outcomes).toEqual([])
    })

    it("acknowledges a previously claimed delivery without replaying its events", async () => {
        const { service, tx, connections, outbox } = await build([event()], [])

        await expect(service.accept(RAW_BODY, SIGNATURE)).resolves.toBeUndefined()

        expect(tx.commits).toBe(1)
        expect(tx.em.query.mock.calls).toEqual([[INSERT_META_INBOX, ["meta", DELIVERY_ID, JSON.stringify(BODY)]]])
        expect(connections.findLiveByMeta).not.toHaveBeenCalled()
        expect(connections.recordEvent).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
    })

    it("opens Facebook and Instagram message windows and queues each event in the claiming transaction", async () => {
        const dm = event({ text: "x".repeat(161) })
        const postback = event({
            kind: "postback",
            platform: "instagram",
            page_id: null,
            ig_id: "ig-1",
            sender_psid: null,
            sender_igsid: "ig-person-1",
            sender_name: null,
            text: null,
            event_key: "postback:button-1",
        })
        const { service, tx, connections, outbox } = await build([dm, postback])

        await expect(service.accept(RAW_BODY, SIGNATURE)).resolves.toBeUndefined()

        const manager = connections.findLiveByMeta.mock.calls[0]?.[3]
        expect(manager).toBeDefined()
        expect(manager).not.toBe(tx.em)
        expect(tx.commits).toBe(1)
        expect(connections.findLiveByMeta.mock.calls).toEqual([
            ["meta", "page_id", "page-1", manager],
            ["meta", "ig_id", "ig-1", manager],
        ])
        expect(tx.em.query.mock.calls).toEqual([
            [INSERT_META_INBOX, ["meta", DELIVERY_ID, JSON.stringify(BODY)]],
            [TOUCH_META_THREAD, ["connection-1", "facebook", "person-1", AT]],
            [TOUCH_META_THREAD, ["connection-1", "instagram", "ig-person-1", AT]],
            [COMPLETE_META_INBOX, ["inbox-1"]],
        ])
        expect(connections.recordEvent.mock.calls).toEqual([
            ["connection-1", { amount: 0, content: "Lan", at: AT, text: "x".repeat(160) }],
            ["connection-1", { amount: 0, content: "postback", at: AT, text: "" }],
        ])
        expect(outbox.entries).toEqual([
            {
                tx: manager,
                queue: META_INBOUND_QUEUE,
                payload: { connectionId: "connection-1", workspaceId: "workspace-1", event: dm },
                inTransaction: true,
            },
            {
                tx: manager,
                queue: META_INBOUND_QUEUE,
                payload: { connectionId: "connection-1", workspaceId: "workspace-1", event: postback },
                inTransaction: true,
            },
        ])
    })

    it("records comment and mention windows when the event carries a comment id", async () => {
        const comment = event({ kind: "comment", comment_id: "comment-1", event_key: "comment:1" })
        const mention = event({
            kind: "mention",
            platform: "instagram",
            page_id: null,
            ig_id: "ig-1",
            comment_id: "comment-2",
            event_key: "mention:2",
        })
        const { service, tx, connections, outbox } = await build([comment, mention])

        await service.accept(RAW_BODY, SIGNATURE)

        const manager = connections.findLiveByMeta.mock.calls[0]?.[3]
        expect(manager).toBeDefined()
        expect(manager).not.toBe(tx.em)
        expect(tx.em.query.mock.calls).toEqual([
            [INSERT_META_INBOX, ["meta", DELIVERY_ID, JSON.stringify(BODY)]],
            [NOTE_META_COMMENT, ["connection-1", "comment-1", "facebook", AT]],
            [NOTE_META_COMMENT, ["connection-1", "comment-2", "instagram", AT]],
            [COMPLETE_META_INBOX, ["inbox-1"]],
        ])
        expect(connections.recordEvent.mock.calls).toEqual([
            ["connection-1", { amount: 0, content: "Lan", at: AT, text: "Hello" }],
            ["connection-1", { amount: 0, content: "Lan", at: AT, text: "Hello" }],
        ])
        expect(outbox.entries).toEqual([
            {
                tx: manager,
                queue: META_INBOUND_QUEUE,
                payload: { connectionId: "connection-1", workspaceId: "workspace-1", event: comment },
                inTransaction: true,
            },
            {
                tx: manager,
                queue: META_INBOUND_QUEUE,
                payload: { connectionId: "connection-1", workspaceId: "workspace-1", event: mention },
                inTransaction: true,
            },
        ])
    })

    it("queues owned events without window ids and lead events without opening either window", async () => {
        const events = [
            event({ sender_psid: null }),
            event({ kind: "postback", sender_psid: null, event_key: "postback:missing-person" }),
            event({ kind: "comment", event_key: "comment:missing-id" }),
            event({ kind: "mention", event_key: "mention:missing-id" }),
            event({ kind: "leadgen", event_key: "leadgen:lead-1" }),
        ]
        const { service, tx, connections, outbox } = await build(events)

        await service.accept(RAW_BODY, SIGNATURE)

        const manager = connections.findLiveByMeta.mock.calls[0]?.[3]
        expect(manager).toBeDefined()
        expect(manager).not.toBe(tx.em)
        expect(tx.em.query.mock.calls).toEqual([
            [INSERT_META_INBOX, ["meta", DELIVERY_ID, JSON.stringify(BODY)]],
            [COMPLETE_META_INBOX, ["inbox-1"]],
        ])
        expect(connections.recordEvent.mock.calls).toEqual(
            events.map(() => ["connection-1", { amount: 0, content: "Lan", at: AT, text: "Hello" }]),
        )
        expect(outbox.entries).toEqual(
            events.map((item) => ({
                tx: manager,
                queue: META_INBOUND_QUEUE,
                payload: { connectionId: "connection-1", workspaceId: "workspace-1", event: item },
                inTransaction: true,
            })),
        )
    })

    it("drops events with no surface identity or whose surface has no live connection", async () => {
        const events = [
            event({ page_id: null }),
            event({ platform: "instagram", ig_id: null }),
            event({ page_id: "unowned-page" }),
            event({ platform: "instagram", ig_id: "unowned-ig" }),
        ]
        const { service, tx, connections, outbox } = await build(events)
        connections.findLiveByMeta.mockResolvedValue(null)

        await service.accept(RAW_BODY, SIGNATURE)

        const manager = connections.findLiveByMeta.mock.calls[0]?.[3]
        expect(manager).toBeDefined()
        expect(manager).not.toBe(tx.em)
        expect(connections.findLiveByMeta.mock.calls).toEqual([
            ["meta", "page_id", "unowned-page", manager],
            ["meta", "ig_id", "unowned-ig", manager],
        ])
        expect(tx.em.query.mock.calls).toEqual([
            [INSERT_META_INBOX, ["meta", DELIVERY_ID, JSON.stringify(BODY)]],
            [COMPLETE_META_INBOX, ["inbox-1"]],
        ])
        expect(connections.recordEvent).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
        expect(tx.commits).toBe(1)
    })

    it("rolls back the claimed delivery when a queued write fails", async () => {
        const { service, tx, outbox } = await build([event()])
        const failure = new Error("queue unavailable")
        outbox.failNext("write", failure)

        await expect(service.accept(RAW_BODY, SIGNATURE)).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)
        expect(tx.em.query.mock.calls).toEqual([
            [INSERT_META_INBOX, ["meta", DELIVERY_ID, JSON.stringify(BODY)]],
            [TOUCH_META_THREAD, ["connection-1", "facebook", "person-1", AT]],
        ])
    })

    describe("deliver", () => {
        it.each([
            {
                name: "a Facebook DM with its PSID taking precedence",
                inbound: event({ sender_igsid: "other-person" }),
                personId: "person-1",
                visitor: "Lan",
            },
            {
                name: "an Instagram DM with its IGSID and a null visitor",
                inbound: event({
                    platform: "instagram",
                    sender_psid: null,
                    sender_igsid: "ig-person-1",
                    sender_name: null,
                    text: "Instagram hello",
                    event_key: "dm:instagram-message-1",
                }),
                personId: "ig-person-1",
                visitor: null,
            },
        ])("delivers $name in one transaction", async ({ inbound, personId, visitor }) => {
            const { service, tx, conversations, connections, outbox } = await build()
            const job: MetaInboundJob = { connectionId: "connection-1", workspaceId: "workspace-1", event: inbound }

            await expect(service.deliver(job)).resolves.toBeUndefined()

            const manager = conversations.acceptMeta.mock.calls[0]?.[2]
            expect(isTransactionManager(manager)).toBe(true)
            expect(manager).not.toBe(tx.em)
            expect(conversations.acceptMeta.mock.calls).toEqual([
                [
                    "connection-1",
                    {
                        platform: inbound.platform,
                        personId,
                        visitor,
                        text: inbound.text,
                        eventId: inbound.event_key,
                    },
                    manager,
                ],
            ])
            expect(tx.commits).toBe(1)
            expect(tx.rollbacks).toBe(0)
            expect(tx.em.transaction).toHaveBeenCalledTimes(1)
            expect(tx.em.query).not.toHaveBeenCalled()
            expect(connections.findLiveByMeta).not.toHaveBeenCalled()
            expect(outbox.jobs).toEqual([])
        })

        it.each([
            { name: "a postback", inbound: event({ kind: "postback" }) },
            { name: "a comment", inbound: event({ kind: "comment" }) },
            { name: "a mention", inbound: event({ kind: "mention" }) },
            { name: "a lead ad", inbound: event({ kind: "leadgen" }) },
            { name: "a DM without a person", inbound: event({ sender_psid: null, sender_igsid: null }) },
            { name: "a DM without text", inbound: event({ text: null }) },
            { name: "a DM with empty text", inbound: event({ text: "" }) },
        ])("leaves $name alone", async ({ inbound }) => {
            const { service, tx, conversations } = await build()

            await expect(
                service.deliver({ connectionId: "connection-1", workspaceId: "workspace-1", event: inbound }),
            ).resolves.toBeUndefined()

            expect(conversations.acceptMeta).not.toHaveBeenCalled()
            expect(tx.em.transaction).not.toHaveBeenCalled()
            expect(tx.outcomes).toEqual([])
        })

        it("normalizes omitted runtime text before handing the DM to conversations", async () => {
            const { service, tx, conversations } = await build()
            const incompleteEvent = omitText(event())

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
})
