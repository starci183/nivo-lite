import { BookingExceptionEntity } from "./booking-exception.entity"

export { BookingExceptionEntity }

/** Every entity the booking-exceptions capability owns, collected by the database connection. */
export const bookingExceptionsEntities = [BookingExceptionEntity] as const
