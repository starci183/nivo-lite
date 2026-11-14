import { Test } from "@nestjs/testing"
import { FakeClock, fakeInbox, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import {
    BUMPED,
    IGNORED,
    INBOUND_NOW as NOW,
    INSERTED,
    NOT_BUMPED,
    eventEntity,
    inboundInput,
} from "@tests/fixtures/builders/inbound-events-service.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { In } from "typeorm"
import { InboundEventsErrorCode } from "./errors/inbound-events.error"
import { InboundEventsService } from "./inbound-events.service"
import { InboundEventEntity } from "./persistence/entities"

const build = async (stubs: MockEntityManager = mockEntityManager()) => {
    const tx = fakeTransaction(stubs)
    const inbox = fakeInbox()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InboundEventsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: INBOX, useValue: inbox },
        ],
    }).compile()
    return { events: moduleRef.get(InboundEventsService), tx, inbox }
}

describe("InboundEventsService keepForOwner", () => {
    it("keeps a message that came too late for an agent as an event the owner decides on", async () => {
        const { events, tx } = await build()
        const [insert] = queueQueryBuilders(tx.em, [IGNORED])

        await events.keepForOwner(tx.em, {
            workspaceId: "ws-1",
            channel: "zalo",
            sender: "Dinh",
            body: "I need some advice",
            eventId: "zalo:c-1:m-1",
        })

        expect(insert?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    channel: "zalo",
                    kind: "message",
                    senderName: "Dinh",
                    body: "I need some advice",
                    eventId: "zalo:c-1:m-1",
                    dedupeKey: "zalo:message:zalo:c-1:m-1",
                    status: "needs_decision",
                },
            ],
        ])
    })
})

describe("InboundEventsService outages of the owner", () => {
    const outage = {
        workspaceId: "ws-1",
        channel: "zalo",
        sender: "OA",
        body: "Upgrade plan",
        eventId: "channel-plan:c-1",
    }

    it("writes a new item for the outage when its series has none open, keyed by the moment it began", async () => {
        const { events, tx } = await build(mockEntityManager({ findOne: [InboundEventEntity, null] }))
        const [insert] = queueQueryBuilders(tx.em, [INSERTED("ev-1")])

        await expect(events.keepOutageForOwner(tx.em, outage)).resolves.toBe(true)

        const stamp = new Date(NOW).getTime()
        expect(insert?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    channel: "zalo",
                    kind: "message",
                    senderName: "OA",
                    body: "Upgrade plan",
                    eventId: `channel-plan:c-1:${stamp}`,
                    dedupeKey: `zalo:message:channel-plan:c-1:${stamp}`,
                    status: "needs_decision",
                },
            ],
        ])
    })

    it("writes nothing while an item of the series is still open, and says so when the key was taken", async () => {
        const open = await build(mockEntityManager({ findOne: [InboundEventEntity, eventEntity({ id: "ev-0" })] }))
        await expect(open.events.keepOutageForOwner(open.tx.em, outage)).resolves.toBe(false)
        expect(open.tx.em.createQueryBuilder).not.toHaveBeenCalled()

        const taken = await build(mockEntityManager({ findOne: [InboundEventEntity, null] }))
        queueQueryBuilders(taken.tx.em, [IGNORED])
        await expect(taken.events.keepOutageForOwner(taken.tx.em, outage)).resolves.toBe(false)
    })

    it("closes the open items of the series when the outage is over", async () => {
        const em = mockEntityManager({ update: [InboundEventEntity, { affected: 1 }] })
        const { events } = await build(em)

        await events.closeOutage("ws-1", "zalo", "channel-plan:c-1")

        expect(em.update).toHaveBeenCalledWith(
            InboundEventEntity,
            expect.objectContaining({
                workspaceId: "ws-1",
                channel: "zalo",
                kind: "message",
                status: "needs_decision",
            }),
            { status: "processed" },
        )
    })
})

describe("InboundEventsService keepUnrouted", () => {
    it("keeps an unrouted message in the inbox under a dedupe key made of its channel and event id", async () => {
        const { events, tx } = await build()
        const [insert] = queueQueryBuilders(tx.em, [IGNORED])

        await events.keepUnrouted(tx.em, {
            workspaceId: "ws-1",
            channel: "telegram",
            sender: "Minh",
            body: "Hello",
            eventId: "tg:c-1:555:9",
        })

        expect(insert?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    channel: "telegram",
                    kind: "message",
                    senderName: "Minh",
                    body: "Hello",
                    eventId: "tg:c-1:555:9",
                    dedupeKey: "telegram:message:tg:c-1:555:9",
                },
            ],
        ])
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
    })
})
describe("InboundEventsService recordInput", () => {
    const input = inboundInput()
    it("records a new channel input after claiming the event", async () => {
        const { events, tx, inbox } = await build()
        const [insert] = queueQueryBuilders(tx.em, [INSERTED("event-1")])
        const claim = jest.spyOn(inbox, "claim")
        const record = jest.spyOn(events, "recordInputInTransaction")

        await expect(events.recordInput(input)).resolves.toEqual({ duplicate: false, inboundEventId: "event-1" })

        expect(inbox.claims).toEqual([{ source: "zalo", eventId: "ws-1:zalo:lead:evt-1" }])
        expect(claim).toHaveBeenCalledWith("zalo", "ws-1:zalo:lead:evt-1", record.mock.calls[0]?.[1])
        expect(record).toHaveBeenCalledWith(input, expect.anything())
        expect(tx.em.transaction).toHaveBeenCalledTimes(1)
        expect(tx.outcomes).toEqual(["commit"])
        expect(insert?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    channel: "zalo",
                    kind: "lead",
                    senderName: "Mai",
                    senderContact: null,
                    body: "Haircut",
                    amountVnd: null,
                    externalRef: null,
                    eventId: "evt-1",
                    dedupeKey: "zalo:lead:evt-1",
                    customerKey: null, source: {},
                },
            ],
        ])
    })

    it("counts a pre-existing domain input and returns its durable id", async () => {
        const { events, tx } = await build()
        const [, bump] = queueQueryBuilders(tx.em, [IGNORED, BUMPED("event-previous")])

        await expect(events.recordInput(input)).resolves.toEqual({ duplicate: true, inboundEventId: "event-previous" })
        expect(bump?.callsOf("where")).toEqual([
            ["workspace_id = :workspaceId AND dedupe_key = :key", { workspaceId: "ws-1", key: "zalo:lead:evt-1" }],
        ])
        expect(bump?.callsOf("set")[0]?.[0]).toMatchObject({ lastDuplicateAt: new Date(NOW) })
    })

    it("rolls the claim back when an existing domain input cannot be read", async () => {
        const { events, tx } = await build()
        queueQueryBuilders(tx.em, [IGNORED, NOT_BUMPED])

        await expect(events.recordInput(input)).rejects.toMatchObject({ code: InboundEventsErrorCode.Unreadable })

        expect(tx.outcomes).toEqual(["rollback"])
    })
})
describe("InboundEventsService repeated inbox input", () => {
    it("reads the row committed together with the previous claim without writing again", async () => {
        const { events, tx, inbox } = await build(mockEntityManager({ findOne: [InboundEventEntity, eventEntity()] }))
        inbox.seen("zalo", "ws-1:zalo:lead:evt-1")

        await expect(events.recordInput(inboundInput())).resolves.toEqual({
            duplicate: true,
            inboundEventId: "event-1",
        })

        expect(inbox.claims).toEqual([{ source: "zalo", eventId: "ws-1:zalo:lead:evt-1" }])
        expect(tx.em.findOne).toHaveBeenCalledTimes(1)
        expect(tx.em.findOne).toHaveBeenCalledWith(InboundEventEntity, {
            select: { id: true },
            where: { workspaceId: "ws-1", dedupeKey: "zalo:lead:evt-1" },
        })
        expect(tx.em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
describe("InboundEventsService find", () => {
    const stored = eventEntity()

    it("returns the inbound event of the workspace", async () => {
        const row = {
            id: "event-1",
            workspace_id: "ws-1",
            channel: "zalo",
            kind: "lead",
            sender_name: "Mai",
            sender_contact: null,
            body: "Haircut",
            amount_vnd: null,
            external_ref: null,
            event_id: "evt-1",
            lead_id: null,
            status: "received",
        }
        const { events, tx } = await build(mockEntityManager({ findOne: [InboundEventEntity, stored] }))

        await expect(events.find("ws-1", "event-1")).resolves.toEqual(row)
        expect(tx.em.findOne).toHaveBeenCalledWith(InboundEventEntity, {
            where: { workspaceId: "ws-1", id: "event-1" },
        })
    })

    it("reads the given inbound events of the workspace once each, and nothing for no id", async () => {
        const { events, tx } = await build(mockEntityManager({ find: [InboundEventEntity, [stored]] }))

        await expect(events.findMany("ws-1", [])).resolves.toEqual([])
        await expect(events.findMany("ws-1", ["event-1", "event-1"])).resolves.toEqual([
            expect.objectContaining({ id: "event-1", workspace_id: "ws-1", channel: "zalo", body: "Haircut" }),
        ])
        expect(tx.em.find).toHaveBeenCalledTimes(1)
        expect(tx.em.find).toHaveBeenCalledWith(InboundEventEntity, {
            where: { workspaceId: "ws-1", id: In(["event-1"]) },
            take: 1,
        })
    })

    it("returns null when the workspace has no such event", async () => {
        const { events, tx } = await build(mockEntityManager({ findOne: [InboundEventEntity, null] }))

        await expect(events.find("ws-1", "missing")).resolves.toBeNull()
        expect(tx.em.findOne).toHaveBeenCalledWith(InboundEventEntity, {
            where: { workspaceId: "ws-1", id: "missing" },
        })
    })

    it("finds a workspace-scoped input through the supplied transaction", async () => {
        const { events, tx } = await build()
        const manager = mockEntityManager({ findOne: [InboundEventEntity, null] })

        await expect(events.find("ws-1", "missing", manager)).resolves.toBeNull()

        expect(manager.findOne).toHaveBeenCalledWith(InboundEventEntity, {
            where: { workspaceId: "ws-1", id: "missing" },
        })
        expect(tx.em.findOne).not.toHaveBeenCalled()
    })
})
describe("InboundEventsService mark", () => {
    it.each([
        ["processed", "lead-1", { status: "processed", leadId: "lead-1" }],
        ["failed", null, { status: "failed" }],
        [null, "lead-2", { leadId: "lead-2" }],
    ] as const)("sets only the given status and lead: %s, %s", async (status, leadId, changes) => {
        const { events, tx } = await build(mockEntityManager({ update: [InboundEventEntity, { affected: 1 }] }))

        await expect(events.mark("ws-1", "event-1", status, leadId)).resolves.toBeUndefined()
        expect(tx.em.update).toHaveBeenCalledWith(InboundEventEntity, { workspaceId: "ws-1", id: "event-1" }, changes)
    })

    it("writes through the manager of the caller's transaction when it is given", async () => {
        const { events, tx } = await build()
        const callers = mockEntityManager({ update: [InboundEventEntity, { affected: 1 }] })

        await events.mark("ws-1", "event-1", "processed", null, callers)

        expect(callers.update).toHaveBeenCalledTimes(1)
        expect(tx.em.update).not.toHaveBeenCalled()
    })

    it("writes nothing when both the status and the lead keep their value", async () => {
        const { events, tx } = await build()

        await expect(events.mark("ws-1", "event-1", null, null)).resolves.toBeUndefined()
        expect(tx.em.update).not.toHaveBeenCalled()
    })
})
