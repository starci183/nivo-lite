import { BookingHourEntity } from "./booking-hour.entity"

export { BookingHourEntity }

/** Every entity the booking-hours capability owns, collected by the database connection. */
export const bookingHoursEntities: readonly [typeof BookingHourEntity] = [BookingHourEntity] as const
