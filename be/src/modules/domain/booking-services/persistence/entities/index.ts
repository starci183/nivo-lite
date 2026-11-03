import { BookingServiceEntity } from "./booking-service.entity"

export { BookingServiceEntity }

/** Every entity the booking-services capability owns, collected by the database connection. */
export const bookingServicesEntities: readonly [typeof BookingServiceEntity] = [BookingServiceEntity] as const
