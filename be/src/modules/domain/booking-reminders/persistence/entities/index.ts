import { BookingReminderEntity } from "./booking-reminder.entity"

export { BookingReminderEntity }

/** Every entity the booking-reminders capability owns, collected by the database connection. */
export const bookingRemindersEntities: readonly [typeof BookingReminderEntity] = [BookingReminderEntity] as const
