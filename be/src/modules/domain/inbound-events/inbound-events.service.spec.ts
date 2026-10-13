import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { InboundEventsErrorCode } from "./errors/inbound-events.error"
import { InboundEventsService } from "./inbound-events.service"
import {
    BUMP_DUPLICATE_EVENT,
    HOLD_EVENT_FOR_OWNER,
    INSERT_BANK_EVENT,
    INSERT_ORDER_HANDOFF,
    INSERT_UNROUTED_EVENT,
} from "./persistence/inbound-events.sql"

const NOW = "2026-10-12T10:00:00.000Z"

const build = async (stubs: ReadonlyArray<readonly [string, unknown]>) => {
    const tx = fakeTransaction(mockEntityManager({ query: stubs }))
    const moduleRef = await Test.createTestingModule({
        providers: [
            InboundEventsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { events: moduleRef.get(InboundEventsService), tx }
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
