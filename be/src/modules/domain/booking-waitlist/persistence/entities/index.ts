import { BookingWaitlistEntity } from "./booking-waitlist.entity"

export { BookingWaitlistEntity }

/** Every entity the booking-waitlist capability owns, collected by the database connection. */
export const bookingWaitlistEntities: readonly [typeof BookingWaitlistEntity] = [BookingWaitlistEntity] as const
