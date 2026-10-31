import { BookingEntity } from "./booking.entity"
import { BookingRateEntity } from "./booking-rate.entity"

export { BookingEntity, BookingRateEntity }

/** Every entity the bookings capability owns, collected by the database connection. */
export const bookingsEntities = [BookingEntity, BookingRateEntity] as const
