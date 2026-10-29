import { builder } from "@starci/jest-preset"
import { In } from "typeorm"
import { bookingRemindersEntities } from "@modules/domain/booking-reminders"
import type { ReminderTarget } from "@modules/domain/booking-reminders"

const [BookingReminderEntity] = bookingRemindersEntities
type BookingReminderEntity = InstanceType<typeof BookingReminderEntity>

/** One hour in milliseconds. */
export const HOUR = 3_600_000

/** The instant the reminder specs run at. */
export const NOW = Date.UTC(2026, 9, 12)

/** A booking `b1` starting thirty hours after {@link NOW}, with the default offsets of 24 and 2 hours. */
export const targetOf = builder<Omit<ReminderTarget, "manager">>({
    workspaceId: "ws-1",
    bookingId: "b1",
    startMs: NOW + 30 * HOUR,
    nowMs: NOW,
    defaultHours: [24, 2],
})

/** A scheduled 24-hour reminder `r1` of booking `b1`. */
export const reminderOf = builder<BookingReminderEntity>({
    id: "r1",
    workspaceId: "ws-1",
    bookingId: "b1",
    kind: "h24",
    dueAt: new Date(NOW),
    status: "scheduled",
    workItemId: null,
    note: "",
    sentAt: null,
    createdAt: new Date(NOW),
})

/** The reminder `r2` of booking `b2` in workspace `ws-2`, due at {@link NOW} for the 2-hour offset. */
export const secondBookingReminder = (): BookingReminderEntity =>
    reminderOf({ id: "r2", workspaceId: "ws-2", bookingId: "b2", kind: "h2", dueAt: new Date(NOW) })

/** The 24-hour reminder `r1` that fell due an hour before {@link NOW}. */
export const overdueDayReminder = (): BookingReminderEntity => reminderOf({ kind: "h24", dueAt: new Date(NOW - HOUR) })

/** The filter that picks reminder `r1`. */
export const REMINDER_R1_WHERE = { id: "r1" }

/** What settling `r1` as sent writes. */
export const SENT_SETTLEMENT = {
    status: "sent",
    workItemId: "item-1",
    sentAt: new Date(NOW),
    note: "Customer messaged",
}

/** What settling `r1` as skipped with the given note writes. */
export const skippedSettlement = (note: string) => ({ status: "skipped", workItemId: null, sentAt: null, note })

/** The filter of the open reminders of booking `b1`. */
export const OPEN_REMINDERS_OF_B1 = { bookingId: "b1", status: In(["scheduled", "waiting"]) }

/** What cancelling a finished booking's reminders writes. */
export const CANCELLED_BOOKING_DONE = { status: "cancelled", note: "booking_done" }
