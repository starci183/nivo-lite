import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingRemindersService } from "./booking-reminders.service"
import type { ReminderTarget } from "./booking-reminders.service"
import {
    CANCEL_OPEN_REMINDERS,
    CANCEL_STALE_REMINDERS,
    CLAIM_DUE_REMINDERS,
    SELECT_REMINDER_CARD,
    SETTLE_REMINDER,
    UPSERT_REMINDERS,
} from "./persistence/booking-reminders.sql"

const HOUR = 3_600_000
const NOW = Date.UTC(2026, 9, 12)
const targetOf = builder<Omit<ReminderTarget, "manager">>({
    workspaceId: "ws-1",
    bookingId: "b1",
    startMs: NOW + 30 * HOUR,
    nowMs: NOW,
    defaultHours: [24, 2],
})

const build = async (manager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingRemindersService, { provide: PRIMARY_ENTITY_MANAGER, useValue: manager }],
    }).compile()
    return moduleRef.get(BookingRemindersService)
}

describe("BookingRemindersService claimDue", () => {
    it("claims the due reminders and maps them in due order", async () => {
        const manager = mockEntityManager({
            query: [
                CLAIM_DUE_REMINDERS,
                [
                    { id: "r2", workspace_id: "ws-2", booking_id: "b2", kind: "h2", due_ms: NOW },
                    { id: "r1", workspace_id: "ws-1", booking_id: "b1", kind: "h24", due_ms: NOW - HOUR },
                ],
            ],
        })
        const reminders = await build(manager)

        await expect(reminders.claimDue(NOW, 40, "\u0110ang g\u1eedi")).resolves.toEqual([
            { id: "r1", workspaceId: "ws-1", bookingId: "b1", kind: "h24", dueMs: NOW - HOUR },
            { id: "r2", workspaceId: "ws-2", bookingId: "b2", kind: "h2", dueMs: NOW },
        ])

        expect(manager.query.mock.calls).toEqual([
            [CLAIM_DUE_REMINDERS, [new Date(NOW).toISOString(), 40, "\u0110ang g\u1eedi"]],
        ])
    })

    it("returns an empty plan when no reminder is due", async () => {
        const manager = mockEntityManager({ query: [CLAIM_DUE_REMINDERS, []] })
        const reminders = await build(manager)

        await expect(reminders.claimDue(NOW, 3, "\u0110ang g\u1eedi")).resolves.toEqual([])

        expect(manager.query.mock.calls).toEqual([
            [CLAIM_DUE_REMINDERS, [new Date(NOW).toISOString(), 3, "\u0110ang g\u1eedi"]],
        ])
    })
})

describe("BookingRemindersService settle", () => {
    it("records a sent reminder with its work item and sent instant", async () => {
        const manager = mockEntityManager({ query: [SETTLE_REMINDER, []] })
        const reminders = await build(manager)

        await expect(
            reminders.settle("r1", {
                status: "sent",
                workItemId: "item-1",
                sentMs: NOW,
                note: "\u0110\u00e3 nh\u1eafn kh\u00e1ch",
            }),
        ).resolves.toBeUndefined()

        expect(manager.query.mock.calls).toEqual([
            [
                SETTLE_REMINDER,
                ["r1", "sent", "item-1", new Date(NOW).toISOString(), "\u0110\u00e3 nh\u1eafn kh\u00e1ch"],
            ],
        ])
    })

    it("records a skipped reminder without a work item or sent instant", async () => {
        const manager = mockEntityManager({ query: [SETTLE_REMINDER, []] })
        const reminders = await build(manager)

        await expect(
            reminders.settle("r1", {
                status: "skipped",
                workItemId: null,
                sentMs: null,
                note: "L\u1ecbch \u0111\u00e3 \u0111\u00f3ng ho\u1eb7c \u0111\u00e3 qua gi\u1edd",
            }),
        ).resolves.toBeUndefined()

        expect(manager.query.mock.calls).toEqual([
            [
                SETTLE_REMINDER,
                [
                    "r1",
                    "skipped",
                    null,
                    null,
                    "L\u1ecbch \u0111\u00e3 \u0111\u00f3ng ho\u1eb7c \u0111\u00e3 qua gi\u1edd",
                ],
            ],
        ])
    })
})

describe("BookingRemindersService cardOf", () => {
    it("reads the custom hours and trims the wording of the reminder card", async () => {
        const manager = mockEntityManager({
            query: [
                SELECT_REMINDER_CARD,
                [{ config: { firstHours: 24, secondHours: "2" }, body: "  Ch\u00e0o {{ten_khach}}  " }],
            ],
        })
        const reminders = await build(manager)

        await expect(reminders.cardOf("ws-1")).resolves.toEqual({ hours: [24, 2], body: "Ch\u00e0o {{ten_khach}}" })

        expect(manager.query.mock.calls).toEqual([[SELECT_REMINDER_CARD, ["ws-1"]]])
    })

    it("returns no hours or body when there is no enabled card", async () => {
        const manager = mockEntityManager({ query: [SELECT_REMINDER_CARD, []] })
        const reminders = await build(manager)

        await expect(reminders.cardOf("ws-1")).resolves.toEqual({ hours: [], body: null })

        expect(manager.query.mock.calls).toEqual([[SELECT_REMINDER_CARD, ["ws-1"]]])
    })

    it.each([null, "", " \n\t "])("returns no wording for a blank body %j", async (body) => {
        const manager = mockEntityManager({ query: [SELECT_REMINDER_CARD, [{ config: null, body }]] })
        const reminders = await build(manager)

        await expect(reminders.cardOf("ws-1")).resolves.toEqual({ hours: [], body: null })

        expect(manager.query.mock.calls).toEqual([[SELECT_REMINDER_CARD, ["ws-1"]]])
    })
})

describe("BookingRemindersService schedule", () => {
    it("writes one reminder per default offset still ahead and cancels the stale ones", async () => {
        const manager = mockEntityManager({
            query: [
                [SELECT_REMINDER_CARD, []],
                [UPSERT_REMINDERS, []],
                [CANCEL_STALE_REMINDERS, []],
            ],
        })
        const reminders = await build()

        const plan = await reminders.schedule({ ...targetOf(), manager })

        expect(plan).toEqual([
            { kind: "h24", dueMs: NOW + 6 * HOUR },
            { kind: "h2", dueMs: NOW + 28 * HOUR },
        ])
        expect(manager.query.mock.calls).toEqual([
            [SELECT_REMINDER_CARD, ["ws-1"]],
            [
                UPSERT_REMINDERS,
                [
                    "ws-1",
                    "b1",
                    ["h24", "h2"],
                    [new Date(NOW + 6 * HOUR).toISOString(), new Date(NOW + 28 * HOUR).toISOString()],
                ],
            ],
            [CANCEL_STALE_REMINDERS, ["b1", new Date(NOW).toISOString(), "past_due_after_move"]],
        ])
    })

    it("uses the offsets of the reminder card the owner customised", async () => {
        const manager = mockEntityManager({
            query: [
                [SELECT_REMINDER_CARD, [{ config: { firstHours: 12, secondHours: 1 } }]],
                [UPSERT_REMINDERS, []],
                [CANCEL_STALE_REMINDERS, []],
            ],
        })
        const reminders = await build()

        const plan = await reminders.schedule({ ...targetOf(), manager })

        expect(plan).toEqual([
            { kind: "h12", dueMs: NOW + 18 * HOUR },
            { kind: "h1", dueMs: NOW + 29 * HOUR },
        ])
        expect(manager.query.mock.calls).toEqual([
            [SELECT_REMINDER_CARD, ["ws-1"]],
            [
                UPSERT_REMINDERS,
                [
                    "ws-1",
                    "b1",
                    ["h12", "h1"],
                    [new Date(NOW + 18 * HOUR).toISOString(), new Date(NOW + 29 * HOUR).toISOString()],
                ],
            ],
            [CANCEL_STALE_REMINDERS, ["b1", new Date(NOW).toISOString(), "past_due_after_move"]],
        ])
    })
})

describe("BookingRemindersService", () => {
    describe("schedule", () => {
        it("writes nothing when every offset is already past", async () => {
            const manager = mockEntityManager({
                query: [
                    [SELECT_REMINDER_CARD, [{ config: null }]],
                    [CANCEL_STALE_REMINDERS, []],
                ],
            })
            const reminders = await build()

            const plan = await reminders.schedule({ ...targetOf({ startMs: NOW + HOUR }), manager })

            expect(plan).toEqual([])
            expect(manager.query.mock.calls).toEqual([
                [SELECT_REMINDER_CARD, ["ws-1"]],
                [CANCEL_STALE_REMINDERS, ["b1", new Date(NOW).toISOString(), "past_due_after_move"]],
            ])
        })
    })

    describe("cancel", () => {
        it("cancels every open reminder of the booking", async () => {
            const manager = mockEntityManager({ query: [CANCEL_OPEN_REMINDERS, []] })
            const reminders = await build()

            await expect(reminders.cancel(manager, "b1", "booking_done")).resolves.toBeUndefined()

            expect(manager.query.mock.calls).toEqual([[CANCEL_OPEN_REMINDERS, ["b1", "booking_done"]]])
        })
    })
})
