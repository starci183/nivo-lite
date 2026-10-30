import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeInbox, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { In } from "typeorm"
import { InboundEventsErrorCode } from "./errors/inbound-events.error"
import { InboundEventsService } from "./inbound-events.service"
import { InboundEventEntity } from "./persistence/entities"

/** Matches the `() => "now()"` function a write hands the database for a time column. */
const ANY_FUNCTION: unknown = expect.any(Function)

/** What the function held by the named field of a value answers when it is called. */
const runField = (value: unknown, field: string): unknown => {
    const fn: unknown = Reflect.get(Object(value), field)
    return typeof fn === "function" ? Reflect.apply(fn, undefined, []) : undefined
}

const NOW = "2026-10-12T10:00:00.000Z"

const INSERTED = (id: string): QueryBuilderAnswers => ({ execute: { raw: [{ id }] } })
const IGNORED: QueryBuilderAnswers = { execute: { raw: [] } }
const BUMPED = (id: string): QueryBuilderAnswers => ({ execute: { raw: [{ id }] } })
const NOT_BUMPED: QueryBuilderAnswers = { execute: { raw: [] } }

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

const eventOf = (manager: MockEntityManager) => ({
    manager,
    workspaceId: "ws-1",
    sender: null,
    body: "ACB credit",
    amountVnd: 150000,
    externalRef: "NIVO8F3K2",
    providerRef: " casso:7 ",
})

const eventEntity = builder<InboundEventEntity>({
    id: "event-1",
    workspaceId: "ws-1",
    channel: "zalo",
    kind: "lead",
    senderName: "Mai",
    senderContact: null,
    body: "Haircut",
    amountVnd: null,
    externalRef: null,
    dedupeKey: "zalo:lead:evt-1",
    duplicateCount: 0,
    lastDuplicateAt: null,
    eventId: "evt-1",
    leadId: null,
    status: "received",
    createdAt: new Date("2026-10-13T10:00:00.000Z"),
})

describe("InboundEventsService recordBankPayment", () => {
    it("records the credit as one inbound payment event keyed by its trimmed event id", async () => {
        const { events, tx } = await build()
        const [insert] = queueQueryBuilders(tx.em, [INSERTED("event-1")])

        await expect(events.recordBankPayment(eventOf(tx.em))).resolves.toEqual({
            duplicate: false,
            inboundEventId: "event-1",
        })

        expect(insert?.callsOf("insert")).toEqual([[]])
        expect(insert?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    channel: "bank",
                    kind: "payment",
                    senderName: null,
                    body: "ACB credit",
                    amountVnd: 150000,
                    externalRef: "NIVO8F3K2",
                    eventId: "casso:7",
                    dedupeKey: "bank:payment:casso:7",
                },
            ],
        ])
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
        expect(tx.em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })

    it("counts a repeated credit on the event it repeats and records nothing new", async () => {
        const { events, tx } = await build()
        const [, bump] = queueQueryBuilders(tx.em, [IGNORED, BUMPED("event-1")])

        await expect(events.recordBankPayment(eventOf(tx.em))).resolves.toEqual({
            duplicate: true,
            inboundEventId: "event-1",
        })

        expect(bump?.callsOf("update")).toEqual([[]])
        expect(runField(bump?.callsOf("set")[0]?.[0], "duplicateCount")).toBe("duplicate_count + 1")
        expect(bump?.callsOf("set")).toEqual([[{ duplicateCount: ANY_FUNCTION, lastDuplicateAt: new Date(NOW) }]])
        expect(bump?.callsOf("where")).toEqual([
            ["workspace_id = :workspaceId AND dedupe_key = :key", { workspaceId: "ws-1", key: "bank:payment:casso:7" }],
        ])
    })

    it("fails when the first record of a repeat cannot be read back", async () => {
        const { events, tx } = await build()
        queueQueryBuilders(tx.em, [IGNORED, NOT_BUMPED])

        await expect(events.recordBankPayment(eventOf(tx.em))).rejects.toMatchObject({
            code: InboundEventsErrorCode.Unreadable,
        })
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
describe("InboundEventsService holdForOwnerCheck", () => {
    it("holds the event for the owner", async () => {
        const { events, tx } = await build(mockEntityManager({ update: [InboundEventEntity, { affected: 1 }] }))

        await events.holdForOwnerCheck("event-1")

        expect(tx.em.update).toHaveBeenCalledWith(
            InboundEventEntity,
            { id: "event-1", status: "received" },
            { status: "needs_decision" },
        )
    })
})
describe("InboundEventsService recordInput", () => {
    const input = {
        workspaceId: "ws-1",
        channel: "zalo",
        kind: "lead",
        senderName: "Mai",
        senderContact: null,
        body: "Haircut",
        externalRef: null,
        eventId: "evt-1",
    }
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

        await expect(
            events.recordInput({
                workspaceId: "ws-1",
                channel: "zalo",
                kind: "lead",
                senderName: "Mai",
                senderContact: null,
                body: "Haircut",
                externalRef: null,
                eventId: "evt-1",
            }),
        ).resolves.toEqual({ duplicate: true, inboundEventId: "event-1" })

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
        await events.holdForOwnerCheck("event-1", callers)

        expect(callers.update).toHaveBeenCalledTimes(2)
        expect(tx.em.update).not.toHaveBeenCalled()
    })

    it("writes nothing when both the status and the lead keep their value", async () => {
        const { events, tx } = await build()

        await expect(events.mark("ws-1", "event-1", null, null)).resolves.toBeUndefined()
        expect(tx.em.update).not.toHaveBeenCalled()
    })
})
describe("InboundEventsService handOffOrder", () => {
    it.each([
        ["a newly recorded order", INSERTED("event-order-1"), true],
        ["an order already recorded", IGNORED, false],
    ] as const)("answers whether %s was created in the caller's transaction", async (_, answer, created) => {
        const { events, tx } = await build()
        const manager = mockEntityManager()
        const [insert] = queueQueryBuilders(manager, [answer])

        await expect(
            events.handOffOrder(
                {
                    workspaceId: "ws-1",
                    sender: "Mai",
                    contact: "84912345678",
                    body: "Haircut",
                    amountVnd: 200000,
                    ref: "booking:b-1",
                    leadId: "lead-1",
                },
                manager,
            ),
        ).resolves.toBe(created)

        expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(insert?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    channel: "manual",
                    kind: "order",
                    senderName: "Mai",
                    senderContact: "84912345678",
                    body: "Haircut",
                    amountVnd: 200000,
                    externalRef: "booking:b-1",
                    dedupeKey: "order:booking:b-1",
                    leadId: "lead-1",
                },
            ],
        ])
        expect(tx.em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("InboundEventsService consumer transaction", () => {
    const input = {
        workspaceId: "ws-1",
        channel: "manual",
        kind: "lead",
        senderName: "Mai",
        senderContact: null,
        body: "Haircut",
        externalRef: "api:CRM",
        eventId: "request-1",
    }

    it("keeps the input and its inbox receipt in the supplied transaction", async () => {
        const { events, tx, inbox } = await build()
        const manager = mockEntityManager()
        const [insert] = queueQueryBuilders(manager, [INSERTED("event-1")])
        const claim = jest.spyOn(inbox, "claim")

        await expect(events.recordInputInTransaction(input, manager)).resolves.toEqual({
            duplicate: false,
            inboundEventId: "event-1",
        })

        expect(claim).toHaveBeenCalledWith("manual", "ws-1:manual:lead:request-1", manager)
        expect(insert?.callsOf("values")[0]?.[0]).toMatchObject({
            workspaceId: "ws-1",
            channel: "manual",
            kind: "lead",
            externalRef: "api:CRM",
            eventId: "request-1",
            dedupeKey: "manual:lead:request-1",
        })
        expect(tx.em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("InboundEventsService repeated transaction input", () => {
    it("resolves a row committed with the original claim through the supplied transaction", async () => {
        const { events, tx, inbox } = await build()
        inbox.seen("manual", "ws-1:manual:lead:request-1")
        const manager = mockEntityManager({
            findOne: [InboundEventEntity, Object.assign(eventEntity(), { id: "original-event" })],
        })
        const claim = jest.spyOn(inbox, "claim")

        await expect(
            events.recordInputInTransaction(
                {
                    workspaceId: "ws-1",
                    channel: "manual",
                    kind: "lead",
                    senderName: "Mai",
                    senderContact: null,
                    body: "Haircut",
                    externalRef: "api:CRM",
                    eventId: "request-1",
                },
                manager,
            ),
        ).resolves.toEqual({ duplicate: true, inboundEventId: "original-event" })

        expect(claim).toHaveBeenCalledWith("manual", "ws-1:manual:lead:request-1", manager)
        expect(manager.findOne).toHaveBeenCalledTimes(1)
        expect(manager.findOne).toHaveBeenCalledWith(InboundEventEntity, {
            select: { id: true },
            where: { workspaceId: "ws-1", dedupeKey: "manual:lead:request-1" },
        })
        expect(tx.em.findOne).not.toHaveBeenCalled()
    })

    it("refuses an unreadable repeat instead of returning an empty id to intake callers", async () => {
        const { events, tx, inbox } = await build(mockEntityManager({ findOne: [InboundEventEntity, null] }))
        inbox.seen("facebook", "ws-1:facebook:message:evt-1")

        await expect(
            events.recordInput({
                workspaceId: "ws-1",
                channel: "facebook",
                kind: "message",
                senderName: "Mai",
                senderContact: null,
                body: "Haircut",
                externalRef: null,
                eventId: "evt-1",
            }),
        ).rejects.toMatchObject({ code: InboundEventsErrorCode.Unreadable })

        expect(tx.outcomes).toEqual(["rollback"])
        expect(tx.em.findOne).toHaveBeenCalledWith(InboundEventEntity, {
            select: { id: true },
            where: { workspaceId: "ws-1", dedupeKey: "facebook:message:evt-1" },
        })
    })
})
