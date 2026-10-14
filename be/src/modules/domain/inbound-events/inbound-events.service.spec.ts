import { Test } from "@nestjs/testing"
import { FakeClock, fakeInbox, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { InboundEventsErrorCode } from "./errors/inbound-events.error"
import { InboundEventsService } from "./inbound-events.service"
import {
    BUMP_DUPLICATE_EVENT,
    FIND_INBOUND_EVENT,
    HOLD_EVENT_FOR_OWNER,
    INSERT_BANK_EVENT,
    INSERT_INPUT_EVENT,
    INSERT_ORDER_HANDOFF,
    INSERT_UNROUTED_EVENT,
    MARK_INBOUND_EVENT,
} from "./persistence/inbound-events.sql"

const NOW = "2026-10-12T10:00:00.000Z"

const build = async (stubs: ReadonlyArray<readonly [string, unknown]>) => {
    const tx = fakeTransaction(mockEntityManager({ query: stubs }))
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

const eventOf = (manager: ReturnType<typeof mockEntityManager>) => ({
    manager,
    workspaceId: "ws-1",
    origin: "live" as const,
    sender: null,
    body: "ACB credit",
    amountVnd: 150000,
    externalRef: "NIVO8F3K2",
    providerRef: " casso:7 ",
})

describe("InboundEventsService", () => {
    describe("recordBankPayment", () => {
        it("records the credit as one inbound payment event keyed by its trimmed event id", async () => {
            const { events, tx } = await build([[INSERT_BANK_EVENT, [{ id: "event-1" }]]])

            await expect(events.recordBankPayment(eventOf(tx.em))).resolves.toEqual({
                duplicate: false,
                inboundEventId: "event-1",
            })

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_BANK_EVENT, [
                "ws-1",
                "live",
                null,
                "ACB credit",
                150000,
                "NIVO8F3K2",
                "casso:7",
                "bank:payment:casso:7",
            ])
            expect(tx.em.query).not.toHaveBeenCalledWith(BUMP_DUPLICATE_EVENT, expect.anything())
        })

        it("counts a repeated credit on the event it repeats and records nothing new", async () => {
            const { events, tx } = await build([
                [INSERT_BANK_EVENT, []],
                [BUMP_DUPLICATE_EVENT, [{ id: "event-1" }]],
            ])

            await expect(events.recordBankPayment(eventOf(tx.em))).resolves.toEqual({
                duplicate: true,
                inboundEventId: "event-1",
            })

            expect(tx.em.query).toHaveBeenCalledWith(BUMP_DUPLICATE_EVENT, [
                "ws-1",
                "bank:payment:casso:7",
                new Date(NOW),
            ])
        })

        it("fails when the first record of a repeat cannot be read back", async () => {
            const { events, tx } = await build([
                [INSERT_BANK_EVENT, []],
                [BUMP_DUPLICATE_EVENT, []],
            ])

            await expect(events.recordBankPayment(eventOf(tx.em))).rejects.toMatchObject({
                code: InboundEventsErrorCode.Unreadable,
            })
        })
    })

    describe("keepUnrouted", () => {
        it("keeps an unrouted message in the inbox under a dedupe key made of its channel and event id", async () => {
            const { events, tx } = await build([[INSERT_UNROUTED_EVENT, []]])

            await events.keepUnrouted(tx.em, {
                workspaceId: "ws-1",
                channel: "telegram",
                sender: "Minh",
                body: "Hello",
                eventId: "tg:c-1:555:9",
            })

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_UNROUTED_EVENT, [
                "ws-1",
                "telegram",
                "Minh",
                "Hello",
                "tg:c-1:555:9",
                "telegram:message:tg:c-1:555:9",
            ])
        })
    })

    describe("holdForOwnerCheck", () => {
        it("holds the event for the owner", async () => {
            const { events, tx } = await build([[HOLD_EVENT_FOR_OWNER, [{ id: "event-1" }]]])

            await events.holdForOwnerCheck("event-1")

            expect(tx.em.query).toHaveBeenCalledWith(HOLD_EVENT_FOR_OWNER, ["event-1"])
        })
    })

    describe("recordInput", () => {
        const input = {
            workspaceId: "ws-1",
            channel: "zalo",
            kind: "lead",
            origin: "live" as const,
            senderName: "Mai",
            senderContact: null,
            body: "Haircut",
            externalRef: null,
            eventId: "evt-1",
        }

        it("records a new channel input after claiming the event", async () => {
            const { events, tx, inbox } = await build([[INSERT_INPUT_EVENT, [{ id: "event-1" }]]])

            await expect(events.recordInput(input)).resolves.toEqual({ duplicate: false, inboundEventId: "event-1" })

            expect(inbox.claims).toEqual([{ source: "zalo", eventId: "evt-1" }])
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_INPUT_EVENT, [
                "ws-1",
                "zalo",
                "lead",
                "live",
                "Mai",
                null,
                "Haircut",
                null,
                null,
                "evt-1",
                "zalo:lead:evt-1",
            ])
        })

        it("still records on the domain row when the inbox already holds the event", async () => {
            const { events, inbox } = await build([[INSERT_INPUT_EVENT, [{ id: "event-1" }]]])
            inbox.seen("zalo", "evt-1")

            await expect(events.recordInput(input)).resolves.toEqual({ duplicate: false, inboundEventId: "event-1" })
            expect(inbox.claims).toEqual([{ source: "zalo", eventId: "evt-1" }])
        })

        it.each([
            [[{ id: "event-previous" }], "event-previous"],
            [[], ""],
        ] as const)("counts a repeated input and returns its readable id: %j", async (rows, inboundEventId) => {
            const { events, tx } = await build([
                [INSERT_INPUT_EVENT, []],
                [BUMP_DUPLICATE_EVENT, rows],
            ])

            await expect(events.recordInput(input)).resolves.toEqual({ duplicate: true, inboundEventId })
            expect(tx.em.query).toHaveBeenCalledWith(BUMP_DUPLICATE_EVENT, ["ws-1", "zalo:lead:evt-1", new Date(NOW)])
        })
    })

    describe("find", () => {
        it("returns the inbound event of the workspace", async () => {
            const row = {
                id: "event-1",
                workspace_id: "ws-1",
                channel: "zalo",
                kind: "lead",
                origin: "live",
                sender_name: "Mai",
                sender_contact: null,
                body: "Haircut",
                amount_vnd: null,
                external_ref: null,
                event_id: "evt-1",
                lead_id: null,
                status: "received",
            }
            const { events, tx } = await build([[FIND_INBOUND_EVENT, [row]]])

            await expect(events.find("ws-1", "event-1")).resolves.toEqual(row)
            expect(tx.em.query).toHaveBeenCalledWith(FIND_INBOUND_EVENT, ["ws-1", "event-1"])
        })

        it("returns null when the workspace has no such event", async () => {
            const { events, tx } = await build([[FIND_INBOUND_EVENT, []]])

            await expect(events.find("ws-1", "missing")).resolves.toBeNull()
            expect(tx.em.query).toHaveBeenCalledWith(FIND_INBOUND_EVENT, ["ws-1", "missing"])
        })
    })

    describe("mark", () => {
        it.each([
            ["processed", "lead-1"],
            [null, null],
        ] as const)("sets the event status and lead while passing null through: %s, %s", async (status, leadId) => {
            const { events, tx } = await build([[MARK_INBOUND_EVENT, []]])

            await expect(events.mark("ws-1", "event-1", status, leadId)).resolves.toBeUndefined()
            expect(tx.em.query).toHaveBeenCalledWith(MARK_INBOUND_EVENT, ["ws-1", "event-1", status, leadId])
        })
    })

    describe("handOffOrder", () => {
        it.each([
            ["a newly recorded order", [{ id: "event-order-1" }], true],
            ["an order already recorded", [], false],
        ] as const)("answers whether %s was created in the caller's transaction", async (_, rows, created) => {
            const { events, tx } = await build([])
            const manager = mockEntityManager({ query: [INSERT_ORDER_HANDOFF, rows] })

            await expect(
                events.handOffOrder(
                    {
                        workspaceId: "ws-1",
                        origin: "live",
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

            expect(manager.query).toHaveBeenCalledTimes(1)
            expect(manager.query).toHaveBeenCalledWith(INSERT_ORDER_HANDOFF, [
                "ws-1",
                "live",
                "Mai",
                "84912345678",
                "Haircut",
                200000,
                "booking:b-1",
                "lead-1",
            ])
            expect(tx.em.query).not.toHaveBeenCalled()
        })
    })
})
