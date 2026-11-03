import { BookingExceptionEntity } from "./booking-exception.entity"

export { BookingExceptionEntity }

/** Every entity the booking-exceptions capability owns, collected by the database connection. */
export const bookingExceptionsEntities: readonly [typeof BookingExceptionEntity] = [BookingExceptionEntity] as const
