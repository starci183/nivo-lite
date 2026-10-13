import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import { BookingRemindersService } from "./booking-reminders.service"
import type { ReminderTarget } from "./booking-reminders.service"
import {
    CANCEL_OPEN_REMINDERS,
    CANCEL_STALE_REMINDERS,
    SELECT_REMINDER_CARD,
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

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [BookingRemindersService] }).compile()
    return moduleRef.get(BookingRemindersService)
}

describe("BookingRemindersService", () => {
    describe("schedule", () => {
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

            expect(plan.map((r) => r.kind)).toEqual(["h24", "h2"])
            expect(manager.query).toHaveBeenCalledWith(UPSERT_REMINDERS, [
                "ws-1",
                "b1",
                ["h24", "h2"],
                [new Date(NOW + 6 * HOUR).toISOString(), new Date(NOW + 28 * HOUR).toISOString()],
            ])
            expect(manager.query).toHaveBeenCalledWith(CANCEL_STALE_REMINDERS, [
                "b1",
                new Date(NOW).toISOString(),
                "past_due_after_move",
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

            expect(plan.map((r) => r.kind)).toEqual(["h12", "h1"])
        })

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
            expect(manager.query).not.toHaveBeenCalledWith(UPSERT_REMINDERS, expect.anything())
        })
    })

    describe("cancel", () => {
        it("cancels every open reminder of the booking", async () => {
            const manager = mockEntityManager({ query: [CANCEL_OPEN_REMINDERS, []] })
            const reminders = await build()

            await reminders.cancel(manager, "b1", "booking_done")

            expect(manager.query).toHaveBeenCalledWith(CANCEL_OPEN_REMINDERS, ["b1", "booking_done"])
        })
    })
})
