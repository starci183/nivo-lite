import { BookingEntity } from "./booking.entity"

export { BookingEntity }

/** Every entity the bookings capability owns, collected by the database connection. */
export const bookingsEntities = [BookingEntity] as const
